import { ServiceUnavailableException } from '@nestjs/common';
import { hashCodigoTelegram, TelegramVinculoService } from './telegram-vinculo.service';
import { extrairCodigo, VALIDADE_CODIGO_MS } from './telegram-regras';
import { chaveConexao } from '../titular';

const user = { id: 'u1', empresaId: 'e1', role: 'membro', email: 'a@b.c' } as never;
const conta = { telegramUserId: '111', chatId: '111', username: 'mike', nome: 'Mike' };

/** Prisma em memória só com o que o serviço usa. */
function fakePrisma() {
  const codigos: Array<Record<string, any>> = [];
  const vinculos: Array<Record<string, any>> = [];
  const conectores: Array<Record<string, any>> = [];
  let seq = 0;
  const prisma: any = {
    codigos,
    vinculos,
    conectores,
    telegramCodigoVinculo: {
      deleteMany: jest.fn(async ({ where }) => {
        for (let i = codigos.length - 1; i >= 0; i--) {
          if (codigos[i].usuarioId === where.usuarioId && codigos[i].usadoEm === null) codigos.splice(i, 1);
        }
        return { count: 0 };
      }),
      create: jest.fn(async ({ data }) => {
        const c = { id: `c${++seq}`, tentativas: 0, usadoEm: null, ...data };
        codigos.push(c);
        return c;
      }),
      findUnique: jest.fn(async ({ where }) => codigos.find((c) => c.codigoHash === where.codigoHash) ?? null),
      update: jest.fn(async ({ where, data }) => {
        const c = codigos.find((x) => x.id === where.id)!;
        if (data.tentativas?.increment) c.tentativas += data.tentativas.increment;
        return c;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const c = codigos.find((x) => x.id === where.id && x.usadoEm === null);
        if (!c) return { count: 0 };
        Object.assign(c, data);
        return { count: 1 };
      }),
      findFirst: jest.fn(async () => null),
    },
    telegramVinculo: {
      findUnique: jest.fn(async ({ where }) =>
        vinculos.find((v) => (where.telegramUserId ? v.telegramUserId === where.telegramUserId : v.usuarioId === where.usuarioId)) ?? null,
      ),
      upsert: jest.fn(async ({ where, create, update }) => {
        const v = vinculos.find((x) => x.usuarioId === where.usuarioId);
        if (v) return Object.assign(v, update);
        const novo = { id: `v${++seq}`, criadoEm: new Date(), ...create };
        vinculos.push(novo);
        return novo;
      }),
      delete: jest.fn(async ({ where }) => {
        vinculos.splice(vinculos.findIndex((v) => v.id === where.id), 1);
      }),
    },
    telegramMensagem: { count: jest.fn(async () => 0) },
    empresaConector: {
      upsert: jest.fn(async ({ create }) => {
        conectores.push(create);
        return create;
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

function montar(configurado = true) {
  const prisma = fakePrisma();
  const api = { configurado: () => configurado, bot: async () => ({ username: 'OracleBot' }) };
  const service = new TelegramVinculoService(prisma as never, api as never);
  return { prisma, service };
}

describe('TelegramVinculoService', () => {
  it('gera código XXXX-XXXX com link do bot e guarda só o hash', async () => {
    const { prisma, service } = montar();
    const r = await service.gerarCodigo(user, 'rep-1');
    expect(r.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.link).toBe(`https://t.me/OracleBot?start=${r.codigo.replace('-', '')}`);
    expect(prisma.codigos).toHaveLength(1);
    expect(prisma.codigos[0].codigoHash).toBe(hashCodigoTelegram(r.codigo));
    expect(JSON.stringify(prisma.codigos[0])).not.toContain(r.codigo.replace('-', ''));
    expect(prisma.codigos[0].repositorioId).toBe('rep-1');
  });

  it('recusa gerar código sem bot configurado', async () => {
    const { service } = montar(false);
    await expect(service.gerarCodigo(user, null)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('um código novo invalida o anterior', async () => {
    const { service } = montar();
    const a = await service.gerarCodigo(user, null);
    await service.gerarCodigo(user, null);
    expect(await service.vincular(a.codigo, conta)).toBe('invalido');
  });

  it('vincula com o código e conecta o card (EmpresaConector pessoal)', async () => {
    const { prisma, service } = montar();
    const { codigo } = await service.gerarCodigo(user, 'rep-1');
    expect(await service.vincular(extrairCodigo(`/start ${codigo.replace('-', '')}`)!, conta)).toBe('ok');
    expect(prisma.vinculos[0]).toMatchObject({ usuarioId: 'u1', telegramUserId: '111', repositorioId: 'rep-1', revogadoEm: null });
    expect(prisma.empresaConector.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: chaveConexao('e1', 'telegram', 'u1') }),
    );
    expect(prisma.conectores[0]).toMatchObject({ titular: 'u1', teamName: '@mike' });
    expect(await service.autorizado('111')).toBeTruthy();
  });

  it('código é de uso único', async () => {
    const { service } = montar();
    const { codigo } = await service.gerarCodigo(user, null);
    expect(await service.vincular(codigo, conta)).toBe('ok');
    expect(await service.vincular(codigo, { ...conta, telegramUserId: '222', chatId: '222' })).toBe('invalido');
  });

  it('código expirado é recusado', async () => {
    const { prisma, service } = montar();
    const { codigo } = await service.gerarCodigo(user, null);
    prisma.codigos[0].expiraEm = new Date(Date.now() - 1);
    expect(await service.vincular(codigo, conta)).toBe('invalido');
    expect(VALIDADE_CODIGO_MS).toBe(10 * 60_000);
  });

  it('bloqueia o código depois de 5 tentativas', async () => {
    const { prisma, service } = montar();
    const { codigo } = await service.gerarCodigo(user, null);
    prisma.codigos[0].tentativas = 5;
    expect(await service.vincular(codigo, conta)).toBe('invalido');
    expect(prisma.codigos[0].tentativas).toBe(6);
  });

  it('não deixa uma conta do Telegram já ligada a outro usuário ser roubada', async () => {
    const { prisma, service } = montar();
    prisma.vinculos.push({ id: 'vx', usuarioId: 'outro', telegramUserId: '111', revogadoEm: null });
    const { codigo } = await service.gerarCodigo(user, null);
    expect(await service.vincular(codigo, conta)).toBe('ocupado');
  });

  it('vínculo revogado não é autorizado', async () => {
    const { prisma, service } = montar();
    prisma.vinculos.push({ id: 'v1', usuarioId: 'u1', telegramUserId: '111', revogadoEm: new Date() });
    expect(await service.autorizado('111')).toBeNull();
    expect(await service.autorizado('999')).toBeNull();
  });
});

describe('extrairCodigo', () => {
  it.each([
    ['/start ABCD2345', 'ABCD2345'],
    ['abcd-2345', 'ABCD2345'],
    ['ABCD 2345', 'ABCD2345'],
    ['/start@OracleBot ABCD2345', 'ABCD2345'],
  ])('%s → %s', (t, esperado) => expect(extrairCodigo(t)).toBe(esperado));

  it.each(['olá', 'ABCD-0000', '/start', 'ABCD23456'])('%s não é código', (t) => expect(extrairCodigo(t)).toBeNull());
});
