// Caracterização de `persistPromptTurn`: o formato gravado é contrato com o
// front (turnos.ts reconstrói os turnos — e as `continuacao` — pela ordem e
// pelo `meta` das mensagens). O orquestrador não pode mudar isto sem querer.
import { ConversasService } from './conversas.service';

function montar() {
  const prisma = {
    conversa: {
      findFirst: jest.fn(),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'c-criada',
        ...data,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    mensagem: {
      create: jest
        .fn()
        .mockResolvedValueOnce({ id: 'm-1' })
        .mockResolvedValueOnce({ id: 'm-2' }),
    },
  };
  const service = new ConversasService(prisma as never);
  return { service, prisma };
}

const base = {
  empresaId: 'e1',
  usuarioId: 'u1',
  modo: 'vault' as const,
  pergunta: 'Qual o plano?',
  resposta: 'O plano é X.',
  fontes: ['Nota A'],
  origemResposta: 'vault' as const,
};

/** [role, conteudo, meta] de cada mensagem criada, em ordem. */
function mensagens(prisma: ReturnType<typeof montar>['prisma']) {
  return prisma.mensagem.create.mock.calls.map(
    ([{ data }]: [{ data: { role: string; conteudo: string; meta?: unknown } }]) => [
      data.role,
      data.conteudo,
      data.meta,
    ],
  );
}

describe('ConversasService.persistPromptTurn (caracterização)', () => {
  it('sem conversa: cria uma de origem prompt e grava pergunta + resposta', async () => {
    const { service, prisma } = montar();
    const r = await service.persistPromptTurn({ ...base, repositorioId: ' repo1 ' });

    expect(prisma.conversa.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversa.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaId: 'e1',
        usuarioId: 'u1',
        origem: 'prompt',
        squadId: null,
        agentId: null,
        modo: 'vault',
        repositorioId: 'repo1',
      }),
    });
    expect(mensagens(prisma)).toEqual([
      ['user', 'Qual o plano?', undefined],
      ['assistant', 'O plano é X.', { fontes: ['Nota A'], origem: 'vault', agente: null }],
    ]);
    expect(r).toEqual({ conversaId: 'c-criada', nova: true, mensagemId: 'm-2' });
  });

  it('conversa existente: busca escopada por dono, origem e repositório', async () => {
    const { service, prisma } = montar();
    prisma.conversa.findFirst.mockResolvedValue({ id: 'c1' });
    const r = await service.persistPromptTurn({
      ...base,
      conversaId: 'c1',
      repositorioId: 'repo1',
    });
    expect(prisma.conversa.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'c1',
        empresaId: 'e1',
        usuarioId: 'u1',
        origem: 'prompt',
        repositorioId: 'repo1',
      },
    });
    expect(prisma.conversa.create).not.toHaveBeenCalled();
    expect(r).toEqual({ conversaId: 'c1', nova: false, mensagemId: 'm-2' });
  });

  it('conversa de outro dono (não encontrada): cria uma nova', async () => {
    const { service, prisma } = montar();
    prisma.conversa.findFirst.mockResolvedValue(null);
    const r = await service.persistPromptTurn({ ...base, conversaId: 'alheia' });
    expect(prisma.conversa.create).toHaveBeenCalled();
    expect(r.nova).toBe(true);
  });

  it('menções vão no meta da pergunta; agente e arquivos no da resposta', async () => {
    const { service, prisma } = montar();
    const mencoes = [{ id: 'a1', titulo: 'Jurídico', mencao: 'Jurídico' }];
    const arquivos = [{ id: 'f1', nome: 'x.md' }];
    await service.persistPromptTurn({
      ...base,
      agente: { id: 'a1', titulo: 'Jurídico' },
      mencoes,
      arquivos,
    });
    expect(mensagens(prisma)).toEqual([
      ['user', 'Qual o plano?', { mencoes }],
      [
        'assistant',
        'O plano é X.',
        {
          fontes: ['Nota A'],
          origem: 'vault',
          agente: { id: 'a1', titulo: 'Jurídico' },
          arquivos,
        },
      ],
    ]);
  });

  it('respostaAdicional com conversa existente grava só a resposta', async () => {
    const { service, prisma } = montar();
    prisma.conversa.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.mensagem.create.mockReset().mockResolvedValue({ id: 'm-só' });
    const r = await service.persistPromptTurn({
      ...base,
      conversaId: 'c1',
      respostaAdicional: true,
    });
    expect(mensagens(prisma).map(([role]) => role)).toEqual(['assistant']);
    expect(r.mensagemId).toBe('m-só');
  });

  it('respostaAdicional sem conversa existente grava a pergunta também', async () => {
    const { service, prisma } = montar();
    await service.persistPromptTurn({ ...base, respostaAdicional: true });
    expect(mensagens(prisma).map(([role]) => role)).toEqual(['user', 'assistant']);
  });

  it('execucaoId (orquestrador) vai no meta da resposta; ausente, o meta não muda', async () => {
    const { service, prisma } = montar();
    await service.persistPromptTurn({ ...base, execucaoId: 'x1' });
    expect(mensagens(prisma)[1][2]).toEqual({
      fontes: ['Nota A'],
      origem: 'vault',
      agente: null,
      execucaoId: 'x1',
    });
  });

  it('atualiza o atualizadoEm da conversa a cada mensagem', async () => {
    const { service, prisma } = montar();
    await service.persistPromptTurn(base);
    expect(prisma.conversa.update).toHaveBeenCalledTimes(2);
    expect(prisma.conversa.update).toHaveBeenCalledWith({
      where: { id: 'c-criada' },
      data: { atualizadoEm: expect.any(Date) },
    });
  });
});
