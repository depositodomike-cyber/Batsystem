import { ServiceUnavailableException } from '@nestjs/common';
import {
  mensagensIniciais,
  modoDireto,
  OrquestradorService,
  type EventoOrquestrador,
  type PedidoOrquestrador,
} from './orquestrador.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const user = { id: 'u1', empresaId: 'e1' } as AuthenticatedUser;

const pedido: PedidoOrquestrador = {
  user,
  texto: '  compare minhas notas de café com o mercado ',
  historico: [{ pergunta: 'oi', resposta: 'olá' }],
  referencia: 'To-do: comprar café',
  conversaId: 'c1',
  repositorioId: 'repo1',
  organizacaoId: 'org1',
  agentesSistema: ['s1'],
};

const plano = {
  objetivo: 'comparar',
  etapas: [{ chave: 'e1', descricao: 'buscar', ferramenta: 'buscar_memoria', dependeDe: [] }],
};

function montar() {
  const prisma = {
    execucao: {
      create: jest.fn().mockResolvedValue({ id: 'x1' }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockReturnValue('upd-exec'),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    aprovacaoAcao: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    etapaExecucao: { updateMany: jest.fn().mockReturnValue('upd-etapas') },
    registroAuditoria: { createMany: jest.fn().mockReturnValue('audit') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const prompt = {
    responder: jest.fn().mockResolvedValue({
      tipo: 'resposta',
      resposta: 'direta',
      fontes: ['N'],
      origem: 'vault',
      conversaId: 'c1',
      mensagemId: 'm1',
      agente: null,
      arquivos: [],
    }),
    refinarTitulo: jest.fn(),
  };
  const conversas = {
    persistPromptTurn: jest.fn().mockResolvedValue({ conversaId: 'c1', nova: false, mensagemId: 'm9' }),
  };
  const roteador = { decidir: jest.fn() };
  const planejador = {
    planejar: jest.fn().mockResolvedValue({ plano, padrao: false, usage: { entrada: 10, saida: 2 } }),
  };
  const executor = {
    retomar: jest.fn(),
    continuar: jest.fn(),
    executar: jest.fn().mockResolvedValue({
      tipo: 'resposta',
      resposta: 'comparação pronta',
      fontes: ['Nota café', { titulo: 'G1', url: 'https://g1' }],
      ferramentasUsadas: ['buscar_memoria', 'buscar_web'],
      usage: { entrada: 1000, saida: 200 },
    }),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const revisor = {
    revisarPlano: jest.fn().mockResolvedValue({ nivel: 'baixo', recomendacao: 'seguir', motivos: [] }),
  };
  const registro = {
    avaliar: jest.fn(async () => null),
    redigir: jest.fn((_nome: string, entrada: unknown) => entrada),
    redigirSaida: jest.fn((_nome: string, conteudo: string) => conteudo),
    perfil: jest.fn((nome: string) =>
      nome === 'salvar_no_repositorio'
        ? { nome, risco: 'escrita_interna', permissao: 'documentos.enviar' }
        : { nome, risco: 'leitura', permissao: 'ia.usar' },
    ),
  };
  const service = new OrquestradorService(
    prisma as never,
    prompt as never,
    conversas as never,
    roteador as never,
    planejador as never,
    executor as never,
    auditoria as never,
    revisor as never,
    registro as never,
  );
  const eventos: EventoOrquestrador[] = [];
  return { service, prisma, prompt, conversas, roteador, planejador, executor, auditoria, revisor, eventos };
}

describe('mensagensIniciais', () => {
  it('histórico vira mensagens nativas e o pedido leva as referências', () => {
    expect(mensagensIniciais([{ pergunta: 'p', resposta: 'r'.repeat(5000) }], 'pedido', ' ref ')).toEqual([
      { papel: 'user', blocos: [{ tipo: 'texto', texto: 'p' }] },
      { papel: 'assistant', blocos: [{ tipo: 'texto', texto: 'r'.repeat(4000) }] },
      {
        papel: 'user',
        blocos: [{ tipo: 'texto', texto: "## REFERÊNCIAS (Notas / To-do's do usuário)\nref\n\n## PEDIDO\npedido" }],
      },
    ]);
    expect(mensagensIniciais([], 'só o pedido')).toEqual([
      { papel: 'user', blocos: [{ tipo: 'texto', texto: 'só o pedido' }] },
    ]);
  });
});

describe('modoDireto', () => {
  it.each([
    ['vault', 'web', 'vault'], // escolha explícita do usuário vale
    ['web', 'memoria', 'web'],
    ['auto', 'web', 'web'], // sem escolha: a fonte do roteador
    [undefined, 'web', 'web'],
    ['auto', 'memoria', 'vault'],
    ['auto', undefined, 'auto'], // roteador sem fonte: o Assistente classifica
  ] as const)('pedido %s + roteador %s → %s', (pedido, fonte, esperado) => {
    expect(modoDireto(pedido, fonte)).toBe(esperado);
  });
});

describe('OrquestradorService — modo Repositório no caminho planejado', () => {
  it('"vault" restringe o plano e a execução ao repositório', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    await m.service.orquestrar({ ...pedido, modo: 'vault' }, (e) => m.eventos.push(e));
    expect(m.planejador.planejar.mock.calls[0][3]).toBe(true);
    expect(m.executor.executar.mock.calls[0][0].ctx.somenteRepositorio).toBe(true);
  });

  it('"auto" e "web" não restringem', async () => {
    for (const modo of ['auto', 'web'] as const) {
      const m = montar();
      m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
      await m.service.orquestrar({ ...pedido, modo }, (e) => m.eventos.push(e));
      expect(m.planejador.planejar.mock.calls[0][3]).toBe(false);
      expect(m.executor.executar.mock.calls[0][0].ctx.somenteRepositorio).toBe(false);
    }
  });
});

describe('OrquestradorService.orquestrar', () => {
  it('rota direta com modo "auto" e roteador dizendo "web": pesquisa na web', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'direta', fonte: 'web', motivo: 'notícias' });
    await m.service.orquestrar({ ...pedido, modo: 'auto' }, (e) => m.eventos.push(e));
    expect(m.prompt.responder.mock.calls[0][0].modo).toBe('web');
  });

  it('rota direta: delega ao PromptService exatamente como o /ai/prompt, sem criar execução', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'direta', motivo: 'simples' });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));

    expect(m.prompt.responder).toHaveBeenCalledWith({
      user,
      texto: 'compare minhas notas de café com o mercado',
      modo: 'auto',
      historico: pedido.historico,
      referencia: 'To-do: comprar café',
      conversaId: 'c1',
      repositorioId: 'repo1',
      organizacaoId: 'org1',
      mencoes: [],
      respostaAdicional: false,
    });
    expect(m.prisma.execucao.create).not.toHaveBeenCalled();
    expect(m.eventos).toEqual([
      { type: 'rota', rota: 'direta', motivo: 'simples' },
      { type: 'resposta', resposta: 'direta', fontes: ['N'], origem: 'vault', conversaId: 'c1', mensagemId: 'm1' },
    ]);
  });

  it('rota plano: cria a execução, planeja, executa, grava na conversa e conclui', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: 'várias fontes', usage: { entrada: 5, saida: 1 } });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));

    expect(m.prisma.execucao.create).toHaveBeenCalledWith({
      data: {
        empresaId: 'e1',
        usuarioId: 'u1',
        organizacaoId: 'org1',
        repositorioId: 'repo1',
        pedido: 'compare minhas notas de café com o mercado',
        status: 'planejando',
        contextoExterno: true,
        origem: 'texto',
      },
    });
    const [, , mensagens] = m.planejador.planejar.mock.calls[0];
    expect(m.executor.executar).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: 'x1',
        ctx: {
          user,
          organizacaoId: 'org1',
          repositorioId: 'repo1',
          agentesSistema: ['s1'],
          somenteRepositorio: false,
        },
        plano: 'Objetivo: comparar\ne1. buscar [buscar_memoria]',
        mensagens,
      }),
    );
    expect(m.conversas.persistPromptTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversaId: 'c1',
        pergunta: 'compare minhas notas de café com o mercado',
        resposta: 'comparação pronta',
        origemResposta: 'vault',
        agente: null,
        execucaoId: 'x1',
      }),
    );
    expect(m.prisma.execucao.update).toHaveBeenLastCalledWith({
      where: { id: 'x1' },
      data: expect.objectContaining({
        status: 'concluida',
        resultado: 'comparação pronta',
        conversaId: 'c1',
        tokensEntrada: 1015,
        tokensSaida: 203,
      }),
    });
    // Conversa já existia (nova: false): o título não é refeito.
    expect(m.prompt.refinarTitulo).not.toHaveBeenCalled();
    expect(m.eventos.map((e) => e.type)).toEqual(['rota', 'execucao', 'plano', 'resposta']);
    expect(m.eventos.at(-1)).toMatchObject({ execucaoId: 'x1', mensagemId: 'm9', origem: 'vault' });
    expect(m.auditoria.registrar.mock.calls.map(([e]) => e.evento)).toEqual([
      'execucao.criada',
      'execucao.concluida',
    ]);
  });

  it('conversa nova criada pela execução ganha o título resumido', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.conversas.persistPromptTurn.mockResolvedValue({ conversaId: 'c-nova', nova: true, mensagemId: 'm1' });
    await m.service.orquestrar({ ...pedido, conversaId: undefined }, (e) => m.eventos.push(e));
    expect(m.prompt.refinarTitulo).toHaveBeenCalledWith(
      user,
      'c-nova',
      'compare minhas notas de café com o mercado',
      'comparação pronta',
    );
  });

  it('só web, sem memória → origem web', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.executor.executar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'r',
      fontes: [],
      ferramentasUsadas: ['buscar_web'],
      usage: { entrada: 0, saida: 0 },
    });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.conversas.persistPromptTurn.mock.calls[0][0].origemResposta).toBe('web');
  });

  it('falha no executor: execução falhou, auditada, e o erro chega ao cliente', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.executor.executar.mockRejectedValue(new ServiceUnavailableException('Nenhuma IA conectada.'));
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.prisma.execucao.update).toHaveBeenLastCalledWith({
      where: { id: 'x1' },
      data: expect.objectContaining({ status: 'falhou', erro: 'Nenhuma IA conectada.' }),
    });
    expect(m.eventos.at(-1)).toEqual({ type: 'error', message: 'Nenhuma IA conectada.' });
    expect(m.conversas.persistPromptTurn).not.toHaveBeenCalled();
    expect(m.auditoria.registrar.mock.calls.at(-1)[0].evento).toBe('execucao.falhou');
  });

  it('erro interno não vaza detalhes para o cliente', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.executor.executar.mockRejectedValue(new Error('connection string postgres://...'));
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.eventos.at(-1)).toEqual({ type: 'error', message: 'Falha ao executar o pedido.' });
  });
});

const estadoPausado = {
  versao: 1,
  turno: 1,
  mensagens: [],
  usage: { entrada: 1, saida: 1 },
  fontes: [],
  usadas: [],
  chamadasFeitas: 1,
  ordem: 1,
  anteriores: [],
  pendente: {
    blocos: [null],
    aguardando: [
      {
        aprovacaoId: 'ap1',
        etapaId: 'et1',
        chave: 't1.1',
        indice: 0,
        idChamada: 'c1',
        ferramenta: 'salvar_no_repositorio',
        entrada: { titulo: 'Plano', conteudo: '# Plano' },
        resumo: 'Salvar "Plano.md"',
        expiraEm: '2026-11-12T00:00:00.000Z',
      },
    ],
    etapasTurno: ['t1.1'],
  },
};

describe('OrquestradorService — revisão do plano', () => {
  it('plano só de leituras não é revisado', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.revisor.revisarPlano).not.toHaveBeenCalled();
    expect(m.executor.executar.mock.calls[0][0].pedido).toBe('compare minhas notas de café com o mercado');
  });

  it('plano com escrita é revisado, auditado e o parecer fica no plano', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.planejador.planejar.mockResolvedValue({
      plano: {
        objetivo: 'salvar',
        etapas: [{ chave: 'e1', descricao: 'salvar', ferramenta: 'salvar_no_repositorio', dependeDe: [] }],
      },
      padrao: false,
    });
    m.revisor.revisarPlano.mockResolvedValue({ nivel: 'medio', recomendacao: 'atencao', motivos: ['m'] });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));

    expect(m.revisor.revisarPlano).toHaveBeenCalledWith(
      user,
      'compare minhas notas de café com o mercado',
      'Objetivo: salvar\ne1. salvar [salvar_no_repositorio]',
    );
    expect(m.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ evento: 'revisao.plano' }));
    const planoGravado = m.prisma.execucao.update.mock.calls.find(([a]) => a.data.plano)?.[0].data.plano;
    expect(planoGravado.revisao).toEqual({ nivel: 'medio', recomendacao: 'atencao', motivos: ['m'] });
    // Parecer do plano é registro, não freio: a execução segue.
    expect(m.executor.executar).toHaveBeenCalled();
  });
});

describe('OrquestradorService — pausa para aprovação', () => {
  it('executor pausou: execução aguardando, estado salvo, aprovação enviada, nada gravado na conversa', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    m.executor.executar.mockResolvedValue({
      tipo: 'pausa',
      aprovacoes: estadoPausado.pendente.aguardando,
      estado: estadoPausado,
      usage: { entrada: 100, saida: 10 },
    });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));

    expect(m.prisma.execucao.update).toHaveBeenLastCalledWith({
      where: { id: 'x1' },
      data: {
        status: 'aguardando_aprovacao',
        estado: {
          executor: estadoPausado,
          pedido: { conversaId: 'c1', modo: undefined, agentesSistema: ['s1'] },
          tokens: { entrada: 110, saida: 12 },
        },
        tokensEntrada: 110,
        tokensSaida: 12,
      },
    });
    expect(m.conversas.persistPromptTurn).not.toHaveBeenCalled();
    expect(m.eventos.at(-1)).toEqual({
      type: 'aprovacao',
      execucaoId: 'x1',
      aprovacoes: [
        {
          id: 'ap1',
          chave: 't1.1',
          ferramenta: 'salvar_no_repositorio',
          resumo: 'Salvar "Plano.md"',
          entrada: { titulo: 'Plano', conteudo: '# Plano' },
          expiraEm: '2026-11-12T00:00:00.000Z',
        },
      ],
    });
  });
});

describe('OrquestradorService.decidir', () => {
  const futuro = new Date(Date.now() + 60_000);

  function comAprovacao(m: ReturnType<typeof montar>, extra: Record<string, unknown> = {}) {
    m.prisma.aprovacaoAcao.findFirst.mockResolvedValue({
      id: 'ap1',
      status: 'pendente',
      expiraEm: futuro,
      execucaoId: 'x1',
      ferramenta: 'salvar_no_repositorio',
      risco: 'escrita_interna',
      ...extra,
    });
    m.prisma.execucao.updateMany.mockResolvedValue({ count: 1 });
    m.prisma.execucao.findUniqueOrThrow.mockResolvedValue({
      id: 'x1',
      pedido: 'salve o plano',
      plano,
      organizacaoId: 'org-da-execucao',
      repositorioId: 'repo-da-execucao',
      estado: {
        executor: estadoPausado,
        pedido: { conversaId: 'c1', modo: 'auto', agentesSistema: null },
        tokens: { entrada: 50, saida: 5 },
      },
    });
    m.prisma.aprovacaoAcao.findMany.mockResolvedValue([
      {
        id: 'ap1',
        status: 'aprovada',
        entrada: { titulo: 'Plano', conteudo: '# Plano' },
        hashEntrada: 'h',
        motivo: null,
      },
    ]);
    m.executor.retomar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'Salvei.',
      fontes: [],
      ferramentasUsadas: ['salvar_no_repositorio'],
      usage: { entrada: 10, saida: 1 },
    });
  }

  it('só quem pediu decide: outra pessoa recebe 404', async () => {
    const m = montar();
    m.prisma.aprovacaoAcao.findFirst.mockResolvedValue(null);
    await expect(m.service.decidir(user, 'ap1', true, undefined, () => undefined)).rejects.toThrow(
      'Aprovação não encontrada.',
    );
    expect(m.prisma.aprovacaoAcao.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ap1', empresaId: 'e1', solicitanteId: 'u1' } }),
    );
  });

  it('já decidida (ou decidida ao mesmo tempo por outra requisição) → conflito, sem retomar', async () => {
    const m = montar();
    comAprovacao(m, { status: 'aprovada' });
    await expect(m.service.decidir(user, 'ap1', true, undefined, () => undefined)).rejects.toThrow(/já foi decidida/);
    comAprovacao(m);
    m.prisma.aprovacaoAcao.updateMany.mockResolvedValue({ count: 0 });
    await expect(m.service.decidir(user, 'ap1', true, undefined, () => undefined)).rejects.toThrow(/já foi decidida/);
    expect(m.executor.retomar).not.toHaveBeenCalled();
  });

  it('aprovada e última pendente: retoma no escopo da EXECUÇÃO e grava a resposta', async () => {
    const m = montar();
    comAprovacao(m);
    await m.service.decidir(user, 'ap1', true, undefined, (e) => m.eventos.push(e));

    expect(m.prisma.aprovacaoAcao.updateMany).toHaveBeenCalledWith({
      where: { id: 'ap1', status: 'pendente' },
      data: expect.objectContaining({ status: 'aprovada', decididoPorId: 'u1' }),
    });
    expect(m.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ evento: 'aprovacao.concedida' }));
    expect(m.prisma.execucao.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', usuarioId: 'u1', status: 'aguardando_aprovacao' },
      data: { status: 'executando' },
    });
    const chamada = m.executor.retomar.mock.calls[0][0];
    expect(chamada.ctx).toEqual({
      user,
      organizacaoId: 'org-da-execucao',
      repositorioId: 'repo-da-execucao',
      agentesSistema: null,
      somenteRepositorio: false,
    });
    expect([...chamada.decisoes.keys()]).toEqual(['ap1']);
    expect(m.conversas.persistPromptTurn).toHaveBeenCalledWith(
      expect.objectContaining({ pergunta: 'salve o plano', resposta: 'Salvei.', execucaoId: 'x1', conversaId: 'c1' }),
    );
    expect(m.prisma.execucao.update).toHaveBeenLastCalledWith({
      where: { id: 'x1' },
      data: expect.objectContaining({ status: 'concluida', tokensEntrada: 60, tokensSaida: 6 }),
    });
    expect(m.eventos.map((e) => e.type)).toEqual(['execucao', 'resposta']);
  });

  it('aprovar depois do prazo grava "expirada"', async () => {
    const m = montar();
    comAprovacao(m, { expiraEm: new Date(Date.now() - 1000) });
    await m.service.decidir(user, 'ap1', true, undefined, () => undefined);
    expect(m.prisma.aprovacaoAcao.updateMany.mock.calls[0][0].data.status).toBe('expirada');
  });

  it('ainda há outras pendentes: só registra e avisa, sem retomar', async () => {
    const m = montar();
    comAprovacao(m);
    m.prisma.aprovacaoAcao.count.mockResolvedValue(1);
    await m.service.decidir(user, 'ap1', false, 'não', (e) => m.eventos.push(e));
    expect(m.eventos).toEqual([{ type: 'aguardando', execucaoId: 'x1', pendentes: 1 }]);
    expect(m.executor.retomar).not.toHaveBeenCalled();
    expect(m.prisma.aprovacaoAcao.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'negada', motivo: 'não' });
  });

  it('execução já retomada por outra requisição → conflito', async () => {
    const m = montar();
    comAprovacao(m);
    m.prisma.execucao.updateMany.mockResolvedValue({ count: 0 });
    await expect(m.service.decidir(user, 'ap1', true, undefined, () => undefined)).rejects.toThrow(/já foi retomada/);
    expect(m.executor.retomar).not.toHaveBeenCalled();
  });
});

describe('OrquestradorService — checkpoints', () => {
  it('grava o checkpoint zero (histórico e referências) antes de planejar', async () => {
    const m = montar();
    m.roteador.decidir.mockResolvedValue({ rota: 'plano', motivo: '' });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    const primeiro = m.prisma.execucao.update.mock.calls[0][0];
    expect(primeiro.data.estado.executor.turno).toBe(0);
    expect(primeiro.data.estado.executor.mensagens.at(-1).blocos[0].texto).toContain('To-do: comprar café');
    expect(primeiro.data.estado.pedido).toEqual({ conversaId: 'c1', modo: undefined, agentesSistema: ['s1'] });
    expect(m.planejador.planejar.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.prisma.execucao.update.mock.invocationCallOrder[0],
    );
    expect(typeof m.executor.executar.mock.calls[0][0].aoCheckpoint).toBe('function');
  });
});

describe('OrquestradorService.retomarInterrompida', () => {
  function interrompida(m: ReturnType<typeof montar>, estado: unknown, plano: unknown = { objetivo: 'o', etapas: [] }) {
    m.prisma.execucao.findFirst.mockResolvedValue({ status: 'interrompida' });
    m.prisma.execucao.updateMany.mockResolvedValue({ count: 1 });
    m.prisma.execucao.findUniqueOrThrow.mockResolvedValue({
      id: 'x1',
      pedido: 'compare',
      plano,
      organizacaoId: 'org-x',
      repositorioId: 'repo-x',
      estado,
    });
  }
  const executorSalvo = { ...estadoPausado, pendente: undefined };
  const salvo = (executor: unknown) => ({
    executor,
    pedido: { conversaId: 'c1', modo: 'auto', agentesSistema: null },
    tokens: { entrada: 100, saida: 10 },
  });

  it('404 para execução de outra pessoa; 409 se não está interrompida', async () => {
    const m = montar();
    m.prisma.execucao.findFirst.mockResolvedValue(null);
    await expect(m.service.retomarInterrompida(user, 'x1', () => undefined)).rejects.toThrow('Execução não encontrada.');
    m.prisma.execucao.findFirst.mockResolvedValue({ status: 'concluida' });
    await expect(m.service.retomarInterrompida(user, 'x1', () => undefined)).rejects.toThrow(/interrompida/);
  });

  it('sem aprovações pendentes: reivindica, continua do checkpoint e conclui', async () => {
    const m = montar();
    interrompida(m, salvo(executorSalvo));
    m.executor.continuar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'retomado',
      fontes: [],
      ferramentasUsadas: [],
      usage: { entrada: 5, saida: 1 },
    });
    await m.service.retomarInterrompida(user, 'x1', (e) => m.eventos.push(e));

    expect(m.prisma.execucao.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', usuarioId: 'u1', status: 'interrompida' },
      data: { status: 'executando', erro: null },
    });
    expect(m.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ evento: 'execucao.retomada' }));
    const chamada = m.executor.continuar.mock.calls[0][0];
    expect(chamada.ctx).toMatchObject({ organizacaoId: 'org-x', repositorioId: 'repo-x' });
    expect(chamada.estado).toEqual({ ...executorSalvo, retomadas: 1 });
    expect(m.planejador.planejar).not.toHaveBeenCalled();
    expect(m.conversas.persistPromptTurn).toHaveBeenCalledWith(
      expect.objectContaining({ pergunta: 'compare', resposta: 'retomado', execucaoId: 'x1' }),
    );
    expect(m.prisma.execucao.update).toHaveBeenLastCalledWith({
      where: { id: 'x1' },
      data: expect.objectContaining({ status: 'concluida', tokensEntrada: 105, tokensSaida: 11 }),
    });
  });

  it('caiu antes do plano: planeja de novo com o histórico salvo', async () => {
    const m = montar();
    interrompida(m, salvo({ ...executorSalvo, turno: 0 }), null);
    m.executor.continuar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'ok',
      fontes: [],
      ferramentasUsadas: [],
      usage: { entrada: 0, saida: 0 },
    });
    await m.service.retomarInterrompida(user, 'x1', (e) => m.eventos.push(e));
    expect(m.planejador.planejar).toHaveBeenCalledWith(user, 'compare', executorSalvo.mensagens, false);
    expect(m.eventos.map((e) => e.type)).toEqual(['execucao', 'plano', 'resposta']);
  });

  it('parada em aprovações: monta as decisões pelo que o banco diz que aconteceu', async () => {
    const m = montar();
    interrompida(m, salvo(estadoPausado));
    m.prisma.aprovacaoAcao.findMany.mockResolvedValue([
      { id: 'ap1', status: 'aprovada', entrada: { titulo: 'Plano' }, hashEntrada: 'h', motivo: null },
    ]);
    (m.prisma as unknown as { etapaExecucao: { findMany: jest.Mock } }).etapaExecucao.findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'et1', status: 'falhou', saida: null }]);
    m.executor.retomar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'confira',
      fontes: [],
      ferramentasUsadas: [],
      usage: { entrada: 0, saida: 0 },
    });
    await m.service.retomarInterrompida(user, 'x1', () => undefined);
    const decisoes = m.executor.retomar.mock.calls[0][0].decisoes as Map<string, { status: string }>;
    // Aprovada e não concluída = estava rodando na queda → nunca repete.
    expect(decisoes.get('ap1')?.status).toBe('interrompida');
  });

  it('ação já concluída antes da queda → "concluida", com o resultado gravado', async () => {
    const m = montar();
    interrompida(m, salvo(estadoPausado));
    m.prisma.aprovacaoAcao.findMany.mockResolvedValue([
      { id: 'ap1', status: 'aprovada', entrada: {}, hashEntrada: 'h', motivo: null },
    ]);
    (m.prisma as unknown as { etapaExecucao: { findMany: jest.Mock } }).etapaExecucao.findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'et1', status: 'concluida', saida: { conteudo: 'Documento salvo.' } }]);
    m.executor.retomar.mockResolvedValue({
      tipo: 'resposta',
      resposta: 'ok',
      fontes: [],
      ferramentasUsadas: [],
      usage: { entrada: 0, saida: 0 },
    });
    await m.service.retomarInterrompida(user, 'x1', () => undefined);
    const decisoes = m.executor.retomar.mock.calls[0][0].decisoes as Map<string, { status: string; conteudo?: string }>;
    expect(decisoes.get('ap1')).toMatchObject({ status: 'concluida', conteudo: 'Documento salvo.' });
  });

  it('sem estado salvo (execução antiga): falha com mensagem clara', async () => {
    const m = montar();
    interrompida(m, null);
    await m.service.retomarInterrompida(user, 'x1', (e) => m.eventos.push(e));
    expect(m.eventos.at(-1)).toEqual({
      type: 'error',
      message: 'Esta execução não tem estado salvo para retomar.',
    });
  });
});

describe('OrquestradorService.cancelar e abertas', () => {
  it('cancela execução parada e nega as aprovações pendentes', async () => {
    const m = montar();
    m.prisma.execucao.findFirst.mockResolvedValue({ id: 'x1' });
    m.prisma.execucao.updateMany.mockResolvedValue({ count: 1 });
    expect(await m.service.cancelar(user, 'x1')).toEqual({ ok: true });
    expect(m.prisma.execucao.updateMany).toHaveBeenCalledWith({
      where: { id: 'x1', usuarioId: 'u1', status: { in: ['aguardando_aprovacao', 'interrompida'] } },
      data: expect.objectContaining({ status: 'cancelada' }),
    });
    expect(m.prisma.aprovacaoAcao.updateMany).toHaveBeenCalledWith({
      where: { execucaoId: 'x1', status: 'pendente' },
      data: expect.objectContaining({ status: 'negada', motivo: 'Execução descartada pelo usuário.' }),
    });
    expect(m.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ evento: 'execucao.cancelada' }));
  });

  it('não cancela execução concluída nem de outra pessoa', async () => {
    const m = montar();
    m.prisma.execucao.findFirst.mockResolvedValue(null);
    await expect(m.service.cancelar(user, 'x1')).rejects.toThrow('Execução não encontrada.');
    m.prisma.execucao.findFirst.mockResolvedValue({ id: 'x1' });
    m.prisma.execucao.updateMany.mockResolvedValue({ count: 0 });
    await expect(m.service.cancelar(user, 'x1')).rejects.toThrow(/parada/);
  });

  it('abertas: só do usuário, recentes, e diz quais dá para retomar', async () => {
    const m = montar();
    m.prisma.execucao.findMany.mockResolvedValue([
      { id: 'a', pedido: 'p', status: 'interrompida', criadoEm: new Date(), estado: { executor: {} }, etapas: [], aprovacoes: [] },
      { id: 'b', pedido: 'p', status: 'interrompida', criadoEm: new Date(), estado: null, etapas: [], aprovacoes: [] },
      {
        id: 'c',
        pedido: 'p',
        status: 'aguardando_aprovacao',
        criadoEm: new Date(),
        estado: { executor: {} },
        etapas: [],
        aprovacoes: [{ id: 'ap', ferramenta: 'f', resumo: 'r', entrada: {}, expiraEm: new Date(), revisao: null, etapa: { chave: 't1.1' } }],
      },
    ]);
    const r = await m.service.abertas(user);
    expect(m.prisma.execucao.findMany.mock.calls[0][0].where).toMatchObject({ empresaId: 'e1', usuarioId: 'u1' });
    expect(r.map((e) => [e.id, e.retomavel])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
    expect(r[2].aprovacoes[0]).toMatchObject({ id: 'ap', chave: 't1.1' });
    expect(r[0]).not.toHaveProperty('estado');
  });
});

describe('OrquestradorService no boot', () => {
  it('marca como interrompidas as execuções que ficaram rodando', async () => {
    const m = montar();
    m.prisma.execucao.findMany.mockResolvedValue([
      { id: 'x1', empresaId: 'e1' },
      { id: 'x2', empresaId: 'e2' },
    ]);
    await m.service.onApplicationBootstrap();
    expect(m.prisma.execucao.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['x1', 'x2'] } },
      data: { status: 'interrompida', erro: 'A API reiniciou durante a execução.' },
    });
    expect(m.prisma.etapaExecucao.updateMany).toHaveBeenCalledWith({
      where: { execucaoId: { in: ['x1', 'x2'] }, status: 'executando' },
      data: { status: 'falhou', erro: 'Interrompida pelo reinício da API.' },
    });
    expect(m.prisma.registroAuditoria.createMany).toHaveBeenCalledWith({
      data: [
        { empresaId: 'e1', execucaoId: 'x1', evento: 'execucao.interrompida' },
        { empresaId: 'e2', execucaoId: 'x2', evento: 'execucao.interrompida' },
      ],
    });
    expect(m.prisma.$transaction).toHaveBeenCalledWith(['upd-exec', 'upd-etapas', 'audit']);
  });

  it('sem execuções presas, não escreve nada', async () => {
    const m = montar();
    await m.service.onApplicationBootstrap();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('OrquestradorService — comandos de computador (caminho rápido)', () => {
  const comComandos = (decisao: unknown) => {
    const m = montar();
    const comandos = { interpretar: jest.fn().mockResolvedValue(decisao) };
    (m.service as unknown as { comandos: unknown }).comandos = comandos;
    return { ...m, comandos };
  };

  it('comando reconhecido: não chama roteador nem planejador; executor recebe a chamada direta, sem histórico', async () => {
    const m = comComandos({
      acao: 'executar',
      texto: 'abrir figma',
      entendido: 'abrir Figma',
      chamada: { nome: 'desktop_abrir_aplicativo', entrada: { aplicativo: 'figma' } },
    });
    await m.service.orquestrar({ ...pedido, texto: 'abrir firma', alternativas: ['abrir figma'] }, (e) => m.eventos.push(e));
    expect(m.comandos.interpretar).toHaveBeenCalledWith(user, 'abrir firma', ['abrir figma'], undefined);
    expect(m.roteador.decidir).not.toHaveBeenCalled();
    expect(m.planejador.planejar).not.toHaveBeenCalled();
    expect(m.prisma.execucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pedido: 'abrir figma', contextoExterno: false }),
    });
    const args = m.executor.executar.mock.calls[0][0];
    expect(args.primeiraChamada).toEqual({ id: 'comando_direto', nome: 'desktop_abrir_aplicativo', entrada: { aplicativo: 'figma' } });
    expect(args.mensagens).toHaveLength(1); // só o comando, sem histórico/referências
    expect(args.limites).toMatchObject({ maxTurnos: 2, maxChamadas: 1 });
    expect(m.eventos[0]).toEqual({ type: 'rota', rota: 'plano', motivo: 'comando: abrir Figma' });
  });

  it('indisponível: responde o motivo na hora e grava na conversa, sem pesquisar', async () => {
    const m = comComandos({ acao: 'responder', resposta: 'Entendi: **abrir Figma**. Mas não consigo…' });
    await m.service.orquestrar({ ...pedido, texto: 'abrir firma' }, (e) => m.eventos.push(e));
    expect(m.roteador.decidir).not.toHaveBeenCalled();
    expect(m.prompt.responder).not.toHaveBeenCalled();
    expect(m.conversas.persistPromptTurn).toHaveBeenCalledWith(expect.objectContaining({ pergunta: 'abrir firma', resposta: 'Entendi: **abrir Figma**. Mas não consigo…' }));
    expect(m.eventos.at(-1)).toMatchObject({ type: 'resposta', resposta: 'Entendi: **abrir Figma**. Mas não consigo…' });
  });

  it('não é comando: segue o roteador normalmente', async () => {
    const m = comComandos(null);
    m.roteador.decidir.mockResolvedValue({ rota: 'direta', motivo: 'simples' });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.roteador.decidir).toHaveBeenCalled();
  });

  it('falha ao interpretar nunca derruba o pedido', async () => {
    const m = comComandos(null);
    m.comandos.interpretar.mockRejectedValue(new Error('banco fora'));
    m.roteador.decidir.mockResolvedValue({ rota: 'direta', motivo: 'simples' });
    await m.service.orquestrar(pedido, (e) => m.eventos.push(e));
    expect(m.prompt.responder).toHaveBeenCalled();
  });
});
