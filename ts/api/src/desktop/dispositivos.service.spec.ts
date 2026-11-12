import { generateKeyPairSync } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DispositivosService, gerarCodigo } from './dispositivos.service';
import { PoliticaDesktopService } from './politica-desktop.service';

const spki = () =>
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

describe('pareamento (SR-23, SR-28)', () => {
  function montar(pareamento: Record<string, unknown> | null, updateCount = 1) {
    const prisma = {
      pareamentoDesktop: {
        findUnique: jest.fn().mockResolvedValue(pareamento),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
      },
      dispositivoDesktop: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd1', ...data })),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      registroAuditoria: { create: jest.fn() },
    };
    const gateway = { chaveServidor: () => ({ publicaSpkiB64: 'SERVIDOR', impressao: 'AAAA-BBBB-CCCC-DDDD' }) };
    return { s: new DispositivosService(prisma as never, gateway as never, {} as never), prisma };
  }
  const corpo = (o: Record<string, unknown> = {}) => ({ codigo: 'ABCD-EFGH', chavePublica: spki(), nome: 'PC', versao: '1.0.0', ...o });
  const valido = { id: 'p1', empresaId: 'e1', usuarioId: 'u1', usadoEm: null, tentativas: 0, expiraEm: new Date(Date.now() + 60_000) };

  it('código: 8 símbolos do alfabeto sem ambíguos', () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('pareia uma vez: dispositivo nasce PENDENTE e devolve as duas impressões digitais', async () => {
    const m = montar(valido);
    const r = await m.s.parear(corpo());
    expect(m.prisma.dispositivoDesktop.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'pendente', empresaId: 'e1', usuarioId: 'u1' }) });
    expect(r).toMatchObject({ dispositivoId: 'd1', chaveServidor: 'SERVIDOR', impressaoServidor: 'AAAA-BBBB-CCCC-DDDD' });
    expect(r.impressaoDispositivo).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  });

  it('código usado, vencido, inexistente ou com tentativas esgotadas → 401', async () => {
    for (const p of [
      null,
      { ...valido, usadoEm: new Date() },
      { ...valido, expiraEm: new Date(Date.now() - 1) },
      { ...valido, tentativas: 5 },
    ]) {
      await expect(montar(p).s.parear(corpo())).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('corrida: dois agentes com o mesmo código → só o primeiro (updateMany count 0 para o segundo)', async () => {
    await expect(montar(valido, 0).s.parear(corpo())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('chave que não é P-256 ou campos extras → 400', async () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    await expect(montar(valido).s.parear(corpo({ chavePublica: rsa }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(montar(valido).s.parear(corpo({ admin: true }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirmar exige a impressão digital do dispositivo', async () => {
    const m = montar(valido);
    m.prisma.dispositivoDesktop.findFirst.mockResolvedValue({ id: 'd1', status: 'pendente', impressaoDigital: 'AAAA-BBBB-CCCC-DDDD', nome: 'PC' });
    await expect(m.s.confirmar({ id: 'u1', empresaId: 'e1' } as never, 'd1', 'AAAA-BBBB-CCCC-0000')).rejects.toBeInstanceOf(BadRequestException);
    expect(m.prisma.dispositivoDesktop.update).not.toHaveBeenCalled();
    await m.s.confirmar({ id: 'u1', empresaId: 'e1' } as never, 'd1', 'aaaa bbbb cccc dddd');
    expect(m.prisma.dispositivoDesktop.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'conectado' }) }));
  });
});

describe('PoliticaDesktopService — contaminação (SR-06, SR-06c) e política (SR-02, SR-13)', () => {
  const svc = (exec: unknown) => {
    const db = { execucao: { findUnique: jest.fn().mockResolvedValue(exec) } };
    return { s: new PoliticaDesktopService(db as never), db };
  };
  const exec = (etapas: { id: string; status: string; ferramenta: string | null }[], over: Record<string, unknown> = {}) => ({
    contextoExterno: false, origem: 'texto', etapas, ...over,
  });

  it('limpa: só etapas de ferramentas limpas concluídas', async () => {
    const { s, db } = svc(exec([{ id: 'a', status: 'concluida', ferramenta: 'desktop_abrir_aplicativo' }]));
    await expect(s.execucaoLimpa(db as never, 'x', 'b')).resolves.toEqual({ limpa: true, vozAtivacao: false });
  });

  it('contaminacao_memoria: buscar_memoria / consultar_agente / busca de arquivos contaminam', async () => {
    for (const f of ['buscar_memoria', 'consultar_agente', 'desktop_buscar_arquivos', 'desktop_listar_janelas', 'buscar_web', 'ler_emails']) {
      const { s, db } = svc(exec([{ id: 'a', status: 'concluida', ferramenta: f }]));
      await expect(s.execucaoLimpa(db as never, 'x', 'b')).resolves.toMatchObject({ limpa: false });
    }
  });

  it('contaminacao_referencia / contaminacao_historico: contextoExterno contamina', async () => {
    const { s, db } = svc(exec([], { contextoExterno: true }));
    await expect(s.execucaoLimpa(db as never, 'x', 'b')).resolves.toMatchObject({ limpa: false });
  });

  it('a etapa atual não conta; etapas que falharam não contam', async () => {
    const { s, db } = svc(exec([
      { id: 'atual', status: 'concluida', ferramenta: 'buscar_memoria' },
      { id: 'b', status: 'falhou', ferramenta: 'buscar_web' },
    ]));
    await expect(s.execucaoLimpa(db as never, 'x', 'atual')).resolves.toMatchObject({ limpa: true });
  });

  it('voz_ativacao vem do banco', async () => {
    const { s, db } = svc(exec([], { origem: 'voz_ativacao' }));
    await expect(s.execucaoLimpa(db as never, 'x', 'b')).resolves.toMatchObject({ vozAtivacao: true });
  });

  it('alterar: recusa diretório de sistema e campos desconhecidos', async () => {
    const prisma = { politicaDesktop: { upsert: jest.fn().mockResolvedValue({ id: 'p', permissoes: {} }), update: jest.fn() } };
    const s = new PoliticaDesktopService(prisma as never);
    await expect(s.alterar('e', 'u', { diretorios: ['C:\\Windows'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.alterar('e', 'u', { diretorios: ['C:\\Users\\u\\AppData\\Roaming'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.alterar('e', 'u', { semConfirmacao: true })).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.alterar('e', 'u', { dominios: ['exemplo.com/x'] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.politicaDesktop.update).not.toHaveBeenCalled();
    await s.alterar('e', 'u', { diretorios: ['c:/Users/u/Documents'], permissoes: { apps: true } });
    expect(prisma.politicaDesktop.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versao: { increment: 1 }, diretorios: ['C:\\Users\\u\\Documents'] }) }),
    );
  });
});

describe('GB-08: parar tudo', () => {
  it('bloqueia dispositivos, cancela comandos, nega aprovações e descarta execuções paradas', async () => {
    const prisma = {
      dispositivoDesktop: { findMany: jest.fn().mockResolvedValue([{ id: 'd1' }]), updateMany: jest.fn((a: unknown) => ['disp', a]) },
      aprovacaoAcao: { findMany: jest.fn().mockResolvedValue([{ execucaoId: 'x1' }, { execucaoId: 'x1' }]), updateMany: jest.fn((a: unknown) => ['ap', a]) },
      comandoDesktop: { updateMany: jest.fn((a: unknown) => ['cmd', a]) },
      execucao: { updateMany: jest.fn((a: unknown) => ['exec', a]) },
      $transaction: jest.fn().mockResolvedValue([]),
      registroAuditoria: { create: jest.fn() },
    };
    const gateway = { acordar: jest.fn() };
    const s = new DispositivosService(prisma as never, gateway as never, {} as never);
    const r = await s.pararTudo({ id: 'u1', empresaId: 'e1' } as never);
    expect(r).toEqual({ ok: true, dispositivos: 1 });
    expect(prisma.execucao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['x1'] }, status: 'aguardando_aprovacao' }), data: expect.objectContaining({ status: 'cancelada' }) }),
    );
    expect(prisma.dispositivoDesktop.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['d1'] } }, data: { status: 'bloqueado' } });
    expect(prisma.comandoDesktop.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'cancelado' }) }));
    expect(gateway.acordar).toHaveBeenCalledWith('d1');
    expect(prisma.registroAuditoria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ evento: 'desktop.parada' }) }));
  });
});
