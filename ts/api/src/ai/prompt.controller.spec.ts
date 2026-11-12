// Testes de CARACTERIZAÇÃO do POST /ai/prompt: fixam o comportamento atual
// (prompts montados, roteamento, persistência e resposta) para que a extração
// da lógica para um serviço — e o orquestrador depois — não mude nada sem que
// um teste acuse. Se um teste quebrar, a pergunta é "a mudança foi de
// propósito?"; só então atualize o teste/snapshot.
import { BadRequestException } from '@nestjs/common';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';
import { REGRA_ARQUIVO } from './prompt/arquivos';
import { SYSTEM_ROTA, SYSTEM_VAULT, SYSTEM_WEB } from './prompt/framework';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

jest.mock('./analise/extrair-texto', () => ({
  extrairTexto: jest.fn(async (buf: Buffer) => `texto do anexo: ${buf.toString()}`),
}));

const user = { id: 'u1', empresaId: 'e1' } as AuthenticatedUser;

function montar() {
  const ai = {
    completar: jest.fn(),
    completarWeb: jest.fn(),
    personaDoAgente: jest.fn(),
  };
  const vault = { search: jest.fn().mockResolvedValue([]) };
  const repositorioOrg = { search: jest.fn().mockResolvedValue([]) };
  const conversas = {
    persistPromptTurn: jest
      .fn()
      .mockResolvedValue({ conversaId: 'c-nova', nova: false, mensagemId: 'm1' }),
    rename: jest.fn().mockResolvedValue({}),
  };
  const perfil = { trechosRelevantes: jest.fn().mockResolvedValue([]) };
  // Controller real sobre o serviço real: o teste cobre o caminho HTTP inteiro
  // (parse do corpo + lógica), só com as dependências externas simuladas.
  const controller = new PromptController(
    new PromptService(
      ai as never,
      vault as never,
      repositorioOrg as never,
      conversas as never,
      perfil as never,
    ),
  );
  // Resposta padrão do modelo; cada teste sobrescreve quando precisa.
  ai.completar.mockResolvedValue({ text: 'Resposta.', truncated: false });
  ai.completarWeb.mockResolvedValue({ text: 'Da web.', fontes: [], truncated: false });
  return { controller, ai, vault, repositorioOrg, conversas, perfil };
}

type Ctx = ReturnType<typeof montar>;

function perguntar(
  ctx: Ctx,
  body: Record<string, string | undefined>,
  opts: {
    repositorioHeader?: string | null;
    organizacaoId?: string | null;
    arquivo?: { originalname: string; buffer: Buffer; size: number };
  } = {},
) {
  return ctx.controller.prompt(
    user,
    opts.repositorioHeader ?? null,
    opts.organizacaoId ?? null,
    opts.arquivo,
    body,
  );
}

/** Espera as promessas "fire-and-forget" (título refinado) assentarem. */
const assentar = () => new Promise((r) => setImmediate(r));

describe('POST /ai/prompt (caracterização)', () => {
  it('rejeita pergunta vazia', async () => {
    const ctx = montar();
    await expect(perguntar(ctx, { texto: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.ai.completar).not.toHaveBeenCalled();
  });

  describe('modo Memória (vault)', () => {
    it('é o padrão para modo ausente ou inválido e monta o prompt completo', async () => {
      const ctx = montar();
      ctx.perfil.trechosRelevantes.mockResolvedValue([
        { titulo: 'Perfil', conteudo: 'Gosto de café.', path: 'Personal/Profile/Perfil.md' },
      ]);
      ctx.repositorioOrg.search.mockResolvedValue([
        { titulo: 'Política', conteudo: 'Política da organização sobre café.' },
      ]);
      ctx.vault.search.mockResolvedValue([
        { titulo: 'Nota A', conteudo: 'Conteúdo sobre café.', path: 'A.md' },
        // Cópia do perfil indexada no vault: deve sair do bloco.
        { titulo: 'Cópia', conteudo: 'duplicada', path: 'Personal/Profile/x.md' },
      ]);
      ctx.ai.completar.mockResolvedValue({
        text: 'Você gosta de café.\nFONTES: Nota A | Inventada',
        truncated: false,
      });

      const r = await perguntar(
        ctx,
        {
          texto: '  Do que eu gosto? ',
          modo: 'qualquer',
          referencia: '  To-do: comprar café ',
          historico: JSON.stringify([{ pergunta: 'oi', resposta: 'olá' }]),
          conversaId: 'c1',
        },
        { repositorioHeader: 'repo-h', organizacaoId: 'org1' },
      );

      expect(ctx.ai.completar).toHaveBeenCalledTimes(1);
      const [emp, usu, system, userPrompt, maxTokens] = ctx.ai.completar.mock.calls[0];
      expect([emp, usu, maxTokens]).toEqual(['e1', 'u1', 4000]);
      expect(system).toBe(SYSTEM_VAULT);
      expect(userPrompt).toMatchSnapshot();
      expect(userPrompt).not.toContain('duplicada');

      expect(ctx.repositorioOrg.search).toHaveBeenCalledWith('e1', 'org1', 'Do que eu gosto?');
      expect(ctx.vault.search).toHaveBeenCalledWith('e1', 'repo-h', 'Do que eu gosto?', 8);

      // Só fontes que de fato estavam no contexto sobrevivem.
      expect(r).toEqual({
        tipo: 'resposta',
        resposta: 'Você gosta de café.',
        fontes: ['Nota A'],
        origem: 'vault',
        conversaId: 'c-nova',
        mensagemId: 'm1',
        agente: null,
        arquivos: [],
      });
      expect(ctx.conversas.persistPromptTurn).toHaveBeenCalledWith({
        empresaId: 'e1',
        usuarioId: 'u1',
        conversaId: 'c1',
        repositorioId: 'repo-h',
        modo: 'vault',
        pergunta: 'Do que eu gosto?',
        resposta: 'Você gosta de café.',
        fontes: ['Nota A'],
        origemResposta: 'vault',
        agente: null,
        arquivos: [],
        mencoes: [],
        respostaAdicional: false,
      });
    });

    it('prefere o repositório do corpo ao do header', async () => {
      const ctx = montar();
      await perguntar(ctx, { texto: 'x', repositorioId: 'repo-b' }, { repositorioHeader: 'repo-h' });
      expect(ctx.vault.search).toHaveBeenCalledWith('e1', 'repo-b', 'x', 8);
    });

    it('sem notas, usa o aviso de memória vazia', async () => {
      const ctx = montar();
      await perguntar(ctx, { texto: 'pergunta' });
      expect(ctx.ai.completar.mock.calls[0][3]).toMatchSnapshot();
    });

    it('segue sem o Repositório da organização quando a busca falha', async () => {
      const ctx = montar();
      ctx.repositorioOrg.search.mockRejectedValue(new Error('db'));
      ctx.vault.search.mockResolvedValue([{ titulo: 'N', conteudo: 'c', path: 'n.md' }]);
      await perguntar(ctx, { texto: 'pergunta' });
      expect(ctx.ai.completar.mock.calls[0][3]).toContain('### N');
    });

    it('lê o anexo, injeta no prompt e o cita como primeira fonte', async () => {
      const ctx = montar();
      const r = await perguntar(
        ctx,
        { texto: 'resuma' },
        { arquivo: { originalname: 'doc.txt', buffer: Buffer.from('abc'), size: 3 } },
      );
      expect(ctx.ai.completar.mock.calls[0][3]).toContain(
        '## ANEXO (doc.txt)\ntexto do anexo: abc',
      );
      expect(r.fontes).toEqual(['Anexo: doc.txt']);
    });

    it('marca resposta truncada', async () => {
      const ctx = montar();
      ctx.ai.completar.mockResolvedValue({ text: 'Parcial', truncated: true });
      const r = await perguntar(ctx, { texto: 'x' });
      expect(r.resposta).toBe('Parcial\n\n> ⚠️ Resposta truncada por tamanho.');
    });
  });

  describe('modo Web', () => {
    it('usa completarWeb com o perfil relevante e ignora o anexo', async () => {
      const ctx = montar();
      ctx.perfil.trechosRelevantes.mockResolvedValue([{ conteudo: 'Mora em SP.' }]);
      ctx.ai.completarWeb.mockResolvedValue({
        text: ' Notícia. ',
        fontes: [{ titulo: 'G1', url: 'https://g1' }],
        truncated: false,
      });
      const r = await perguntar(
        ctx,
        { texto: 'clima', modo: 'web' },
        { arquivo: { originalname: 'a.txt', buffer: Buffer.from('z'), size: 1 } },
      );
      expect(ctx.ai.completar).not.toHaveBeenCalled();
      const [emp, usu, system, userPrompt, max] = ctx.ai.completarWeb.mock.calls[0];
      expect([emp, usu, system, max]).toEqual(['e1', 'u1', SYSTEM_WEB, 4000]);
      expect(userPrompt).toMatchSnapshot();
      expect(r).toMatchObject({
        resposta: 'Notícia.',
        fontes: [{ titulo: 'G1', url: 'https://g1' }],
        origem: 'web',
      });
      expect(ctx.conversas.persistPromptTurn.mock.calls[0][0]).toMatchObject({
        modo: 'web',
        origemResposta: 'web',
      });
    });
  });

  describe('modo Auto', () => {
    it('classifica sem diretrizes e segue para a Web', async () => {
      const ctx = montar();
      ctx.ai.completar.mockResolvedValueOnce({ text: 'WEB', truncated: false });
      const r = await perguntar(ctx, { texto: 'cotação do dólar hoje', modo: 'auto' });
      expect(ctx.ai.completar).toHaveBeenCalledWith(
        'e1',
        'u1',
        SYSTEM_ROTA,
        'cotação do dólar hoje',
        8,
        'completar',
        { semDiretrizes: true },
      );
      expect(r.origem).toBe('web');
      // O modo gravado é o PEDIDO (auto), não o escolhido.
      expect(ctx.conversas.persistPromptTurn.mock.calls[0][0].modo).toBe('auto');
    });

    it('cai na Memória quando o classificador falha', async () => {
      const ctx = montar();
      ctx.ai.completar
        .mockRejectedValueOnce(new Error('falhou'))
        .mockResolvedValueOnce({ text: 'ok', truncated: false });
      const r = await perguntar(ctx, { texto: 'x', modo: 'auto' });
      expect(r.origem).toBe('vault');
      expect(ctx.ai.completarWeb).not.toHaveBeenCalled();
    });
  });

  describe('agentes', () => {
    it('põe a persona na frente do system, extrai o arquivo e registra quem gerou', async () => {
      const ctx = montar();
      ctx.ai.personaDoAgente.mockResolvedValue({ id: 'a1', titulo: 'Jurídico', texto: 'PERSONA' });
      ctx.ai.completar.mockResolvedValue({
        text: 'Segue.\n\n:::arquivo nome="Plano.md"\n# Plano\n:::\n',
        truncated: false,
      });
      const r = await perguntar(
        ctx,
        { texto: 'faça um plano', agenteId: 'a1' },
        { organizacaoId: 'org1' },
      );
      expect(ctx.ai.personaDoAgente).toHaveBeenCalledWith('a1', {
        empresaId: 'e1',
        usuarioId: 'u1',
        organizacaoId: 'org1',
      });
      expect(ctx.ai.completar.mock.calls[0][2]).toBe(
        `PERSONA\n\n---\n${SYSTEM_VAULT}${REGRA_ARQUIVO}`,
      );
      expect(r.agente).toEqual({ id: 'a1', titulo: 'Jurídico' });
      expect(r.resposta).toBe('Segue.');
      expect(r.arquivos).toEqual([
        {
          id: expect.any(String),
          nome: 'Plano.md',
          tipo: 'md',
          conteudo: '# Plano',
          tamanho: 7,
          geradoPor: { id: 'a1', titulo: 'Jurídico' },
        },
      ]);
    });

    it('sem agente, blocos :::arquivo ficam no texto', async () => {
      const ctx = montar();
      const texto = 'a\n:::arquivo nome="x.md"\nc\n:::';
      ctx.ai.completar.mockResolvedValue({ text: texto, truncated: false });
      const r = await perguntar(ctx, { texto: 'x' });
      expect(r.resposta).toBe(texto);
      expect(r.arquivos).toEqual([]);
    });

    it.each([
      ['inexistente', () => Promise.resolve(null)],
      ['com erro', () => Promise.reject(new Error('db'))],
    ])('agente %s cai no Assistente padrão', async (_n, impl) => {
      const ctx = montar();
      ctx.ai.personaDoAgente.mockImplementation(impl);
      const r = await perguntar(ctx, { texto: 'x', agenteId: 'zz' });
      expect(ctx.ai.completar.mock.calls[0][2]).toBe(SYSTEM_VAULT);
      expect(r.agente).toBeNull();
    });

    it('menções: valida, limita a 10 e trunca os campos', async () => {
      const ctx = montar();
      const muitas = Array.from({ length: 12 }, (_, i) => ({
        id: `id${i}`,
        titulo: 'T'.repeat(100),
        mencao: 'M'.repeat(50),
      }));
      await perguntar(ctx, {
        texto: 'x',
        mencoes: JSON.stringify([{ id: 1 }, ...muitas]),
      });
      const { mencoes } = ctx.conversas.persistPromptTurn.mock.calls[0][0];
      expect(mencoes).toHaveLength(10);
      expect(mencoes[0]).toEqual({ id: 'id0', titulo: 'T'.repeat(80), mencao: 'M'.repeat(41) });
    });

    it('menções e histórico inválidos viram listas vazias', async () => {
      const ctx = montar();
      await perguntar(ctx, { texto: 'x', mencoes: '{', historico: 'nao-json' });
      expect(ctx.conversas.persistPromptTurn.mock.calls[0][0].mencoes).toEqual([]);
      expect(ctx.ai.completar.mock.calls[0][3]).not.toContain('CONVERSA ANTERIOR');
    });

    it.each([
      [{ respostaAdicional: '1', conversaId: 'c1' }, true],
      [{ respostaAdicional: '1' }, false],
      [{ respostaAdicional: 'true', conversaId: 'c1' }, false],
    ])('respostaAdicional %j → %s', async (extra, esperado) => {
      const ctx = montar();
      await perguntar(ctx, { texto: 'x', ...extra });
      expect(ctx.conversas.persistPromptTurn.mock.calls[0][0].respostaAdicional).toBe(esperado);
    });
  });

  it('histórico guarda só os 12 últimos pares válidos', async () => {
    const ctx = montar();
    const historico = Array.from({ length: 15 }, (_, i) => ({
      pergunta: `p${i}`,
      resposta: `r${i}`,
    }));
    await perguntar(ctx, {
      texto: 'x',
      historico: JSON.stringify([...historico, { pergunta: 1 }]),
    });
    const prompt: string = ctx.ai.completar.mock.calls[0][3];
    expect(prompt).not.toContain('p2\n');
    expect(prompt).toContain('p3');
    expect(prompt).toContain('p14');
  });

  describe('persistência', () => {
    it('conversa nova dispara o título refinado, sem diretrizes', async () => {
      const ctx = montar();
      ctx.conversas.persistPromptTurn.mockResolvedValue({
        conversaId: 'c9',
        nova: true,
        mensagemId: 'm9',
      });
      ctx.ai.completar
        .mockResolvedValueOnce({ text: 'Resposta', truncated: false })
        .mockResolvedValueOnce({ text: '"Plano de café da manhã."', truncated: false });
      await perguntar(ctx, { texto: 'x' });
      await assentar();
      expect(ctx.ai.completar).toHaveBeenLastCalledWith(
        'e1',
        'u1',
        expect.stringContaining('título curto de 4 a 6 palavras'),
        'Pergunta: x\nResposta: Resposta',
        24,
        'completar',
        { semDiretrizes: true },
      );
      expect(ctx.conversas.rename).toHaveBeenCalledWith('e1', 'u1', 'c9', 'Plano de café da manhã.');
    });

    it('falha ao gravar não derruba a resposta', async () => {
      const ctx = montar();
      ctx.conversas.persistPromptTurn.mockRejectedValue(new Error('db'));
      const r = await perguntar(ctx, { texto: 'x', conversaId: 'c1' });
      expect(r.resposta).toBe('Resposta.');
      expect(r.conversaId).toBe('c1');
      expect(r.mensagemId).toBeUndefined();
    });
  });
});
