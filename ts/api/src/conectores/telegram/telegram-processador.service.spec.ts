import { TelegramProcessadorService } from './telegram-processador.service';
import { ErroTelegram, redigirToken } from './telegram-api.service';
import { BACKOFF_MS, MSG } from './telegram-regras';

function msgAudio(parcial: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    vinculoId: 'v1',
    chatId: '111',
    messageId: 7,
    tipo: 'voz',
    audioFileId: 'f1',
    audioMime: 'audio/ogg',
    audioNome: null,
    audio: null,
    status: 'recebida',
    tentativas: 0,
    vinculo: { empresaId: 'e1' },
    ...parcial,
  } as never;
}

function montar(chave = 'sk-teste') {
  const updates: Array<Record<string, any>> = [];
  const prisma: any = {
    updates,
    telegramMensagem: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async ({ data }) => {
        updates.push(data);
      }),
    },
  };
  const api = {
    getFile: jest.fn(async () => ({ file_path: 'voice/x.oga', file_size: 10 })),
    baixar: jest.fn(async () => Buffer.from('audio')),
    sendMessage: jest.fn(async () => undefined),
  };
  const chaveOpenAi = { resolver: jest.fn(async () => chave) };
  const p = new TelegramProcessadorService(prisma as never, api as never, chaveOpenAi as never);
  return { p, prisma, api };
}

describe('TelegramProcessadorService', () => {
  it('baixa, guarda o áudio antes de transcrever e marca pronta', async () => {
    const { p, prisma, api } = montar();
    p.transcrever = jest.fn(async (_k, _b, nome) => {
      expect(nome).toBe('voz.ogg');
      // O áudio já foi guardado quando a transcrição começa.
      expect(prisma.updates[0].audio).toBeDefined();
      return 'olá mundo';
    });
    await p.processar(msgAudio());
    expect(prisma.updates.at(-1)).toMatchObject({ status: 'pronta', transcricao: 'olá mundo' });
    expect(api.sendMessage).toHaveBeenCalledWith('111', MSG.transcrito, 7);
  });

  it('falha de transcrição: fica em falha com backoff e o áudio guardado', async () => {
    const { p, prisma, api } = montar();
    p.transcrever = jest.fn(async () => {
      throw new Error('OpenAI 500');
    });
    const antes = Date.now();
    await p.processar(msgAudio());
    const ultimo = prisma.updates.at(-1);
    expect(ultimo).toMatchObject({ status: 'falha', tentativas: 1, erro: 'OpenAI 500' });
    expect(ultimo.proximaTentativaEm.getTime()).toBeGreaterThanOrEqual(antes + BACKOFF_MS[0]);
    expect(ultimo.audio).toBeUndefined(); // nada apaga o áudio
    expect(api.sendMessage).toHaveBeenCalledWith('111', MSG.falhaTranscricao, 7);
  });

  it('depois das retentativas fica em falha sem próxima tentativa (sem descartar)', async () => {
    const { p, prisma, api } = montar();
    p.transcrever = jest.fn(async () => {
      throw new Error('x');
    });
    await p.processar(msgAudio({ tentativas: BACKOFF_MS.length, audio: Buffer.from('a') }));
    expect(prisma.updates.at(-1)).toMatchObject({ status: 'falha', proximaTentativaEm: null });
    expect(api.getFile).not.toHaveBeenCalled(); // reaproveita o áudio já guardado
    expect(api.sendMessage).not.toHaveBeenCalled(); // só avisa na primeira falha
  });

  it('sem chave da OpenAI vira falha explicável', async () => {
    const { p, prisma } = montar('');
    await p.processar(msgAudio());
    expect(prisma.updates.at(-1).erro).toContain('OpenAI');
  });

  it('não processa duas vezes o mesmo item (reivindicação atômica)', async () => {
    const { p, prisma, api } = montar();
    prisma.telegramMensagem.updateMany.mockResolvedValueOnce({ count: 0 });
    await p.processar(msgAudio());
    expect(api.getFile).not.toHaveBeenCalled();
  });

  it('recuperação devolve à fila o que ficou transcrevendo', async () => {
    const { p, prisma } = montar();
    prisma.telegramMensagem.updateMany.mockResolvedValueOnce({ count: 2 });
    expect(await p.recuperar()).toBe(2);
    expect(prisma.telegramMensagem.updateMany).toHaveBeenCalledWith({
      where: { status: 'transcrevendo' },
      data: { status: 'recebida' },
    });
  });
});

describe('segredos fora dos erros', () => {
  it('redige token de bot de qualquer texto', () => {
    const token = '123456789:AAHk3_abcdefghijklmnopqrstuvwxyz012';
    const t = redigirToken(`GET https://api.telegram.org/bot${token}/getUpdates`, token);
    expect(t).not.toContain(token);
    expect(redigirToken(`x ${token} y`)).not.toContain(token);
  });

  it('ErroTelegram não carrega URL', () => {
    const e = new ErroTelegram('getUpdates', 'falha de rede (TypeError)');
    expect(e.message).toBe('Telegram getUpdates: falha de rede (TypeError)');
  });
});
