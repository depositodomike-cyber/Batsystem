import { Prisma } from '@prisma/client';
import { estadoBot, TelegramBotService } from './telegram-bot.service';
import { MSG } from './telegram-regras';
import type { TgMessage, TgUpdate } from './telegram-api.service';

const VINCULO = { id: 'v1', usuarioId: 'u1', empresaId: 'e1', telegramUserId: '111', revogadoEm: null };

function montar(opts: { vinculado?: boolean } = {}) {
  const mensagens: Array<Record<string, any>> = [];
  let offset: bigint | null = null;
  const prisma: any = {
    mensagens,
    get offset() {
      return offset;
    },
    telegramMensagem: {
      create: jest.fn(async ({ data }) => {
        if (mensagens.some((m) => m.chatId === data.chatId && m.messageId === data.messageId)) {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        }
        mensagens.push(data);
        return data;
      }),
    },
    telegramCursor: {
      findUnique: jest.fn(async () => (offset === null ? null : { offset })),
      upsert: jest.fn(async ({ create }) => {
        offset = create.offset;
      }),
    },
  };
  const api = { sendMessage: jest.fn(async () => undefined) };
  const vinculos = {
    autorizado: jest.fn(async (id: string) => (opts.vinculado !== false && id === '111' ? VINCULO : null)),
    vincular: jest.fn(async () => 'ok'),
    registrarComunicacao: jest.fn(async () => undefined),
  };
  const processador = { acordar: jest.fn(), parar: jest.fn() };
  const bot = new TelegramBotService(prisma as never, api as never, vinculos as never, processador as never);
  return { bot, prisma, api, vinculos, processador };
}

let seq = 0;
function msg(parcial: Partial<TgMessage> = {}, de = 111, tipoChat: 'private' | 'group' = 'private'): TgUpdate {
  seq++;
  return {
    update_id: 1000 + seq,
    message: {
      message_id: seq,
      date: 1_700_000_000,
      from: { id: de, first_name: 'Mike', username: 'mike' },
      chat: { id: de, type: tipoChat },
      ...parcial,
    },
  };
}

describe('TelegramBotService — autorização', () => {
  it('ignora grupos sem gravar nem responder', async () => {
    const { bot, prisma, api } = montar();
    await bot.tratarUpdate(msg({ text: 'oi' }, 111, 'group'));
    expect(prisma.telegramMensagem.create).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('usuário não vinculado recebe "bot privado" e nada é gravado', async () => {
    const { bot, prisma, api } = montar({ vinculado: false });
    await bot.tratarUpdate(msg({ text: 'minha ideia secreta' }, 999));
    expect(prisma.telegramMensagem.create).not.toHaveBeenCalled();
    expect(api.sendMessage).toHaveBeenCalledWith('999', MSG.privado, expect.any(Number));
  });

  it('usuário não vinculado com código tenta vincular', async () => {
    const { bot, vinculos, api } = montar({ vinculado: false });
    await bot.tratarUpdate(msg({ text: '/start ABCD2345' }, 999));
    expect(vinculos.vincular).toHaveBeenCalledWith('ABCD2345', expect.objectContaining({ telegramUserId: '999', chatId: '999' }));
    expect(api.sendMessage).toHaveBeenCalledWith('999', MSG.vinculado, expect.any(Number));
  });

  it('ignora mensagens de outros bots', async () => {
    const { bot, prisma } = montar();
    const u = msg({ text: 'x' });
    u.message!.from!.is_bot = true;
    await bot.tratarUpdate(u);
    expect(prisma.telegramMensagem.create).not.toHaveBeenCalled();
  });
});

describe('TelegramBotService — fila e idempotência', () => {
  it('texto vira mensagem pronta com o texto original intacto', async () => {
    const { bot, prisma, api } = montar();
    const original = '  Comprar *café*\n\n  e pão  ';
    await bot.tratarUpdate(msg({ text: original }));
    expect(prisma.mensagens[0]).toMatchObject({ tipo: 'texto', texto: original, status: 'pronta', vinculoId: 'v1', chatId: '111' });
    expect(api.sendMessage).toHaveBeenCalledWith('111', MSG.textoRecebido, expect.any(Number));
  });

  it('o mesmo update repetido não duplica nem responde de novo', async () => {
    const { bot, prisma, api } = montar();
    const u = msg({ text: 'uma vez' });
    await bot.consumir(u);
    await bot.consumir(u);
    expect(prisma.mensagens).toHaveLength(1);
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('o offset só avança depois de gravar', async () => {
    const { bot, prisma } = montar();
    prisma.telegramMensagem.create.mockRejectedValueOnce(new Error('banco fora'));
    const u = msg({ text: 'x' });
    await expect(bot.consumir(u)).rejects.toThrow('banco fora');
    expect(prisma.offset).toBeNull();
    await bot.consumir(u);
    expect(prisma.offset).toBe(BigInt(u.update_id + 1));
    expect(prisma.mensagens).toHaveLength(1);
  });

  it('voz com legenda entra na fila e acorda o processador', async () => {
    const { bot, prisma, processador, api } = montar();
    await bot.tratarUpdate(
      msg({ voice: { file_id: 'f1', mime_type: 'audio/ogg', file_size: 1000, duration: 5 }, caption: 'reunião' }),
    );
    expect(prisma.mensagens[0]).toMatchObject({ tipo: 'voz', legenda: 'reunião', audioFileId: 'f1', status: 'recebida' });
    expect(processador.acordar).toHaveBeenCalled();
    expect(api.sendMessage).toHaveBeenCalledWith('111', MSG.audioRecebido, expect.any(Number));
  });

  it('recusa áudio acima de 20 MB e formato não suportado', async () => {
    const { bot, prisma, api } = montar();
    await bot.tratarUpdate(msg({ audio: { file_id: 'g', mime_type: 'audio/mpeg', file_size: 21 * 1024 * 1024 } }));
    await bot.tratarUpdate(msg({ document: { file_id: 'p', mime_type: 'application/pdf' } }));
    expect(prisma.telegramMensagem.create).not.toHaveBeenCalled();
    expect(api.sendMessage).toHaveBeenNthCalledWith(1, '111', MSG.grandeDemais, expect.any(Number));
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, '111', MSG.naoSuportado, expect.any(Number));
  });
});

describe('estadoBot', () => {
  it('liga só com token e fora do serverless', () => {
    expect(estadoBot(true, false).ativo).toBe(true);
    expect(estadoBot(false, false).ativo).toBe(false);
    expect(estadoBot(true, true).ativo).toBe(false);
  });
});
