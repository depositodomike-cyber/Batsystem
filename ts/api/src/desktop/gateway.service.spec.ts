import { generateKeyPairSync } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ErroFerramenta } from '@/orquestrador/ferramentas/ferramenta';
import { hashEntrada } from '@/orquestrador/politica.service';
import { GatewayDesktopService, redigirParametros, TIMEOUT_RESULTADO_MS } from './gateway.service';

const APP = 'a'.repeat(16);
const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString();

function politicaDb(over: Record<string, unknown> = {}) {
  return {
    id: 'p1', empresaId: 'e1', usuarioId: 'u1', versao: 3,
    permissoes: { apps: true, energia: true, navegador: true, documentos: true, midia: true },
    confirmar: [], apps: [APP], observaveis: [], diretorios: ['C:\\Users\\u\\Documents'], dominios: ['exemplo.com'],
    retencaoDias: 90, criadoEm: new Date(), atualizadoEm: new Date(),
    ...over,
  };
}

function montar(o: {
  dispositivo?: Record<string, unknown> | null;
  limpa?: boolean;
  aprovacao?: Record<string, unknown> | null;
  comandoCreate?: () => Promise<unknown>;
  status?: string;
  resultado?: unknown;
  recentes?: number;
  /** Etapa e pedido gravados, para a checagem de comando direto (SR-06d). */
  etapa?: { tipo: string; ordem: number; execucaoId: string } | null;
  pedido?: string;
  vozAtivacao?: boolean;
} = {}) {
  const ordem: string[] = [];
  const disp =
    o.dispositivo === null
      ? null
      : { id: 'd1', status: 'conectado', paradoLocal: false, versaoAgente: '1.0.0', ultimoContato: new Date(), ...o.dispositivo };
  const tx = {
    dispositivoDesktop: { findFirst: jest.fn().mockResolvedValue(disp) },
    execucao: {
      findFirst: jest.fn().mockResolvedValue({ id: 'x1' }),
      findUnique: jest.fn().mockResolvedValue({ pedido: o.pedido ?? 'qualquer coisa' }),
    },
    etapaExecucao: {
      findUnique: jest.fn().mockResolvedValue(o.etapa === undefined ? { tipo: 'ferramenta', ordem: 1, execucaoId: 'x1' } : o.etapa),
    },
    aprovacaoAcao: { findFirst: jest.fn().mockResolvedValue(o.aprovacao ?? null) },
    comandoDesktop: {
      count: jest.fn().mockResolvedValue(o.recentes ?? 0),
      create: jest.fn(async () => {
        ordem.push('comando');
        return o.comandoCreate ? o.comandoCreate() : {};
      }),
    },
    registroAuditoria: { create: jest.fn(async () => { ordem.push('auditoria'); return {}; }) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    comandoDesktop: {
      findUnique: jest.fn(async () => ({ status: o.status ?? 'concluido', resultado: o.resultado ?? { conteudo: 'Aberto: Figma', verificado: true }, erro: null })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    registroAuditoria: { create: jest.fn().mockResolvedValue({}) },
    dispositivoDesktop: tx.dispositivoDesktop,
  };
  const config = { get: (k: string) => (k === 'DESKTOP_CHAVE_PRIVADA' ? Buffer.from(pem).toString('base64') : undefined) };
  const politicas = {
    obter: jest.fn().mockResolvedValue(politicaDb()),
    execucaoLimpa: jest.fn().mockResolvedValue({ limpa: o.limpa ?? true, vozAtivacao: o.vozAtivacao ?? false }),
  };
  const g = new GatewayDesktopService(prisma as never, config as never, politicas as never);
  jest.spyOn(g, 'liberacao').mockReturnValue({ ativo: true });
  return { g, tx, prisma, ordem };
}

const ctx = (execucao?: { id: string; etapaId: string; aprovacaoId?: string }) =>
  ({ user: { id: 'u1', empresaId: 'e1', role: 'owner' }, organizacaoId: null, repositorioId: null, ...(execucao ? { execucao } : {}) }) as never;

const E = { aplicativo: 'Figma' };
const P = { aplicativoId: APP };

describe('GatewayDesktopService', () => {
  it('SR-09a: sem contexto de execução do executor → nega', async () => {
    const m = montar();
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx())).rejects.toBeInstanceOf(ErroFerramenta);
    expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
  });

  it('moderado limpo: audita ANTES e na mesma transação, cria comando e devolve resultado verificado', async () => {
    const m = montar();
    const r = await m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }));
    expect(r).toBe('Aberto: Figma');
    expect(m.ordem).toEqual(['auditoria', 'comando']);
    expect(m.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    const cmd = (m.tx.comandoDesktop.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(cmd).toMatchObject({ dispositivoId: 'd1', operacao: 'abrir_aplicativo', risco: 'moderado', aprovacaoId: null });
    const env = cmd.envelope as { payload: string };
    const payload = JSON.parse(Buffer.from(env.payload, 'base64').toString());
    expect(payload).toMatchObject({ tipo: 'comando', dispositivoId: 'd1', versaoPolitica: 3, parametros: P });
    expect(typeof payload.emitidoEm).toBe('string');
  });

  it('SR-06: execução contaminada → moderado vira alto e exige aprovação', async () => {
    const m = montar({ limpa: false });
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/aprovação/);
    expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
  });

  describe('SR-05/SR-07 aprovação', () => {
    const exec = { id: 'x1', etapaId: 'et1', aprovacaoId: 'ap1' };
    const ap = (over: Record<string, unknown> = {}) => ({ id: 'ap1', status: 'aprovada', risco: 'alto', hashEntrada: hashEntrada(E), ...over });

    it('aprovacao_ausente: alto sem aprovacaoId → nega', async () => {
      const m = montar();
      await expect(m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/aprovação/);
      expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
    });

    it('aprovacao_escopo: a consulta exige mesma empresa, solicitante, execução, etapa, ferramenta, aprovada e não vencida', async () => {
      const m = montar({ aprovacao: ap() });
      await m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec));
      const where = (m.tx.aprovacaoAcao.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
      expect(where).toMatchObject({
        id: 'ap1', empresaId: 'e1', solicitanteId: 'u1', execucaoId: 'x1', etapaId: 'et1',
        ferramenta: 'desktop_fechar_aplicativo', status: 'aprovada', expiraEm: { gt: expect.any(Date) },
      });
      const cmd = (m.tx.comandoDesktop.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
      expect(cmd.aprovacaoId).toBe('ap1');
    });

    it('aprovacao_hash: parâmetros diferentes dos aprovados → nega', async () => {
      const m = montar({ aprovacao: ap({ hashEntrada: hashEntrada({ aplicativo: 'Outro' }) }) });
      await expect(m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec))).rejects.toThrow(/não confere/);
      expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
    });

    it('aprovacao_risco: aprovação de risco menor não cobre risco alto', async () => {
      const m = montar({ aprovacao: ap({ risco: 'moderado' }) });
      await expect(m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec))).rejects.toThrow(/não confere/);
      const m2 = montar({ aprovacao: ap({ risco: 'escrita_externa' }) });
      await expect(m2.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec))).rejects.toThrow(/não confere/);
    });

    it('aprovacao_reuso: a mesma aprovação não gera dois comandos (unique)', async () => {
      const m = montar({
        aprovacao: ap(),
        comandoCreate: async () => {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        },
      });
      await expect(m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec))).rejects.toThrow(/já foi usada/);
    });
  });

  describe('SR-30 falha fechada', () => {
    it('sem dispositivo, parado, offline, bloqueado ou desatualizado → nega', async () => {
      for (const d of [
        null,
        { paradoLocal: true },
        { status: 'bloqueado' },
        { ultimoContato: new Date(Date.now() - 120_000) },
        { versaoAgente: '0.9.0' },
      ]) {
        const m = montar({ dispositivo: d });
        await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toBeInstanceOf(ErroFerramenta);
        expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
      }
    });

    it('não liberado → nega sem tocar no banco', async () => {
      const m = montar();
      (m.g.liberacao as jest.Mock).mockReturnValue({ ativo: false, motivo: 'x' });
      await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toBeInstanceOf(ErroFerramenta);
      expect(m.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('falha inesperada na transação → nega com mensagem genérica', async () => {
      const m = montar();
      m.prisma.$transaction.mockRejectedValueOnce(new Error('serialization failure'));
      await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/não foi executada/);
    });

    it('SR-33: limite de taxa por dispositivo', async () => {
      const m = montar({ recentes: 30 });
      await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/Limite/);
    });
  });

  it('SR-08: bloqueado pela política nunca enfileira', async () => {
    const m = montar();
    await expect(
      m.g.enviar('desktop_abrir_documento', 'abrir_documento', { caminho: 'C:\\Users\\u\\Documents\\x.exe' }, { caminho: 'C:\\Users\\u\\Documents\\x.exe' }, ctx({ id: 'x1', etapaId: 'et1' })),
    ).rejects.toThrow(/Bloqueado/);
    expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
  });

  it('resultado sem verificação real não é sucesso', async () => {
    const m = montar({ resultado: { conteudo: 'ok', verificado: false } });
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/não conseguiu confirmar/);
  });

  it('SR-29: sem resultado no prazo → estado desconhecido, comando expirado, não repetir', async () => {
    jest.useFakeTimers();
    try {
      const m = montar({ status: 'entregue' });
      const p = m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', E, P, ctx({ id: 'x1', etapaId: 'et1' }));
      const verif = expect(p).rejects.toThrow(/Não repita/);
      await jest.advanceTimersByTimeAsync(TIMEOUT_RESULTADO_MS + 1000);
      await verif;
      expect(m.prisma.comandoDesktop.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'expirado' }) }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('SR-40: parâmetros redigidos não carregam o caminho completo nem a URL', () => {
    const r = redigirParametros({ caminho: 'C:\\Users\\u\\Documents\\Segredo\\proposta.pdf', url: 'https://exemplo.com/?token=abc' });
    expect(JSON.stringify(r)).not.toContain('Segredo');
    expect(JSON.stringify(r)).not.toContain('token');
    expect(String(r.caminho)).toMatch(/^proposta\.pdf \[#[0-9a-f]{12}\]$/);
  });
});

describe('GB-04: aprovação amarrada ao programa exibido', () => {
  const exec = { id: 'x1', etapaId: 'et1', aprovacaoId: 'ap1' };
  const ap = (resumo: string) => ({ id: 'ap1', status: 'aprovada', risco: 'alto', hashEntrada: hashEntrada(E), resumo });

  it('nega quando o nome agora resolve para outro programa que o usuário não viu', async () => {
    const m = montar({ aprovacao: ap('Fechar o aplicativo "Figma" — Programa: C:\Apps\Figma.exe') });
    await expect(
      m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec), ['Programa: C:\Outro\Malware.exe']),
    ).rejects.toThrow(/não confere/);
    expect(m.tx.comandoDesktop.create).not.toHaveBeenCalled();
  });

  it('aceita quando o programa resolvido é o mostrado', async () => {
    const m = montar({ aprovacao: ap('Fechar o aplicativo "Figma" — Programa: C:\Apps\Figma.exe') });
    await m.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', E, P, ctx(exec), ['Programa: C:\Apps\Figma.exe']);
    expect(m.tx.comandoDesktop.create).toHaveBeenCalled();
  });
});


describe('SR-06d: comando direto do usuário', () => {
  const direto = { tipo: 'comando_direto', ordem: 1, execucaoId: 'x1' };
  const ex = { id: 'x1', etapaId: 'et1' };

  it('abrir app por voz, com histórico, roda sem aprovação quando o banco confirma o comando', async () => {
    const m = montar({ limpa: false, vozAtivacao: true, etapa: direto, pedido: 'Oracle, abrir figma' });
    await m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'figma' }, P, ctx(ex));
    const cmd = (m.tx.comandoDesktop.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(cmd.risco).toBe('moderado');
  });

  it('etapa que não é comando_direto (ex.: chamada do modelo) continua exigindo aprovação', async () => {
    const m = montar({ limpa: false, etapa: { tipo: 'ferramenta', ordem: 1, execucaoId: 'x1' }, pedido: 'abrir figma' });
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'figma' }, P, ctx(ex))).rejects.toThrow(/aprovação/);
  });

  it('parâmetros diferentes do que o texto do usuário diz → não é comando direto', async () => {
    const m = montar({ limpa: false, etapa: direto, pedido: 'abrir figma' });
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'spotify' }, P, ctx(ex))).rejects.toThrow(/aprovação/);
  });

  it('a marcação em memória do executor não basta: sem a etapa no banco, exige aprovação', async () => {
    const m = montar({ limpa: false, etapa: null, pedido: 'abrir figma' });
    await expect(
      m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'figma' }, P, ctx({ ...ex, comandoDireto: true } as never)),
    ).rejects.toThrow(/aprovação/);
  });

  it('fechar app e energia continuam altos mesmo como comando direto', async () => {
    const a = montar({ etapa: direto, pedido: 'fechar figma' });
    await expect(a.g.enviar('desktop_fechar_aplicativo', 'fechar_aplicativo', { aplicativo: 'figma' }, P, ctx(ex))).rejects.toThrow(/aprovação/);
    const b = montar({ etapa: direto, pedido: 'desliga o computador' });
    await expect(b.g.enviar('desktop_energia', 'energia', { acao: 'desligar' }, { acao: 'desligar' }, ctx(ex))).rejects.toThrow(/aprovação/);
  });

  it('por voz, um segundo comando direto em menos de 3 s volta a exigir aprovação', async () => {
    const m = montar({ limpa: false, vozAtivacao: true, etapa: direto, pedido: 'abrir figma', recentes: 1 });
    await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'figma' }, P, ctx(ex))).rejects.toThrow(/aprovação/);
  });
});

describe('Desfazer (SR-06d)', () => {
  const original = { id: 'c-orig', etapaId: 'et1', dispositivoId: 'd1', parametros: { aplicativoId: APP }, resultado: { conteudo: 'Figma foi aberto.', verificado: true } };
  const comOriginal = (o: Parameters<typeof montar>[0], orig: unknown) => {
    const m = montar(o);
    (m.tx.comandoDesktop as unknown as { findFirst: jest.Mock }).findFirst = jest.fn().mockResolvedValue(orig);
    return m;
  };

  it('fecha o app aberto por comando direto: comando alto, desfazDe e auditoria antes', async () => {
    const m = comOriginal({ etapa: { tipo: 'comando_direto', ordem: 1, execucaoId: 'x1' } }, original);
    await m.g.desfazer({ id: 'u1', empresaId: 'e1' } as never, 'x1');
    const where = ((m.tx.comandoDesktop as unknown as { findFirst: jest.Mock }).findFirst.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ execucaoId: 'x1', operacao: 'abrir_aplicativo', status: 'concluido', risco: 'moderado', concluidoEm: { gt: expect.any(Date) } });
    expect(m.ordem).toEqual(['auditoria', 'comando']);
    const cmd = (m.tx.comandoDesktop.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(cmd).toMatchObject({ operacao: 'fechar_aplicativo', risco: 'alto', desfazDe: 'c-orig', parametros: { aplicativoId: APP } });
  });

  it('nada recente para desfazer, ou ação que não foi comando direto → nega', async () => {
    await expect(comOriginal({}, null).g.desfazer({ id: 'u1', empresaId: 'e1' } as never, 'x1')).rejects.toThrow(/nada recente/);
    await expect(
      comOriginal({ etapa: { tipo: 'ferramenta', ordem: 1, execucaoId: 'x1' } }, original).g.desfazer({ id: 'u1', empresaId: 'e1' } as never, 'x1'),
    ).rejects.toThrow(/comando direto/);
  });

  it('desfazer duas vezes → "já foi desfeita" (unique)', async () => {
    const m = comOriginal(
      {
        etapa: { tipo: 'comando_direto', ordem: 1, execucaoId: 'x1' },
        comandoCreate: async () => {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        },
      },
      original,
    );
    await expect(m.g.desfazer({ id: 'u1', empresaId: 'e1' } as never, 'x1')).rejects.toThrow(/já foi desfeita/);
  });
});


describe('GC-03/GC-04/GC-06', () => {
  it('GC-03: não desfaz quando o app já estava aberto antes do comando', async () => {
    const m = montar({ etapa: { tipo: 'comando_direto', ordem: 1, execucaoId: 'x1' } });
    (m.tx.comandoDesktop as unknown as { findFirst: jest.Mock }).findFirst = jest.fn().mockResolvedValue({
      id: 'c-orig', etapaId: 'et1', dispositivoId: 'd1', parametros: { aplicativoId: APP },
      resultado: { conteudo: 'Figma já estava aberto; foi acionado de novo.', verificado: true },
    });
    await expect(m.g.desfazer({ id: 'u1', empresaId: 'e1' } as never, 'x1')).rejects.toThrow(/já estava aberto/);
  });

  it('GC-06: etapa comando_direto que não é a 1ª, ou de outra execução, não é comando direto', async () => {
    for (const etapa of [
      { tipo: 'comando_direto', ordem: 2, execucaoId: 'x1' },
      { tipo: 'comando_direto', ordem: 1, execucaoId: 'outra' },
    ]) {
      const m = montar({ limpa: false, etapa, pedido: 'abrir figma' });
      await expect(m.g.enviar('desktop_abrir_aplicativo', 'abrir_aplicativo', { aplicativo: 'figma' }, P, ctx({ id: 'x1', etapaId: 'et1' }))).rejects.toThrow(/aprovação/);
    }
  });
});
