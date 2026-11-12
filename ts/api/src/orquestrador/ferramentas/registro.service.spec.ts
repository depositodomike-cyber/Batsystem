import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { RegistroFerramentasService, MAX_CONTEUDO_FERRAMENTA } from './registro.service';
import { definirFerramenta, ErroFerramenta, type Ferramenta } from './ferramenta';
import { FerramentasLeitura, SYSTEM_CONSULTA_AGENTE } from './leitura';
import { FerramentasEscrita, nomeDoDocumento } from './escrita';
import { FerramentasGeracao } from './geracao';
import { FerramentasConectores } from './conectores';
import { FerramentasWeb } from './web';

const semEscrita = { todas: () => [] } as unknown as FerramentasEscrita;
const semGeracao = { todas: () => [] } as unknown as FerramentasGeracao;
const semConectores = { todas: () => [] } as unknown as FerramentasConectores;
const semWeb = { todas: () => [] } as unknown as FerramentasWeb;
import { validarFerramentas } from '@/ai/tool-use';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

const ctx = {
  user: { id: 'u1', empresaId: 'e1' } as AuthenticatedUser,
  organizacaoId: 'org1',
  repositorioId: 'repo1',
};

function montar() {
  const ai = {
    completar: jest.fn().mockResolvedValue({ text: ' Parecer. ', truncated: false }),
    completarWeb: jest.fn(),
    personaDoAgente: jest.fn(),
  };
  const prompt = { recuperarMemoria: jest.fn() };
  const agentes = {
    sistemaDaOrganizacao: jest
      .fn()
      .mockResolvedValue([{ id: 's1', titulo: 'Estratégia', mencao: 'Estratégia', descricao: 'decisões', icone: null }]),
    meus: jest.fn().mockResolvedValue([{ id: 'p1', titulo: 'Revisor', mencao: 'Revisor', descricao: '' }]),
    daOrganizacao: jest.fn().mockResolvedValue([]),
  };
  const leitura = new FerramentasLeitura(ai as never, prompt as never, agentes as never);
  const repositorioOrg = {
    enviar: jest.fn().mockResolvedValue({ id: 'd1', nome: 'Plano.md', status: 'disponivel', erro: null }),
  };
  const escrita = new FerramentasEscrita(repositorioOrg as never);
  const geradores = {
    melhorar: jest.fn().mockResolvedValue({ texto: 'Texto bom.', resumo: 'Mais direto.', conexoes: '' }),
    ata: jest.fn().mockResolvedValue({ titulo: 'Ata 10/11', ata: '- Decisão A', memoria: false }),
    artigo: jest.fn().mockResolvedValue({ titulo: 'IA', subtitulo: 'no varejo', conteudo: 'Corpo.', conexoes: '' }),
  };
  const geracao = new FerramentasGeracao(geradores as never);
  const registro = new RegistroFerramentasService(leitura, escrita, geracao, semConectores, semWeb);
  return { registro, ai, prompt, agentes, repositorioOrg, geradores };
}

describe('RegistroFerramentasService', () => {
  it('registra as leituras (ia.usar) e a escrita no Repositório (documentos.enviar)', () => {
    const { registro } = montar();
    expect(registro.perfis()).toEqual([
      { nome: 'buscar_memoria', risco: 'leitura', permissao: 'ia.usar', dadosExternos: false },
      { nome: 'buscar_web', risco: 'leitura', permissao: 'ia.usar', dadosExternos: true },
      { nome: 'listar_agentes', risco: 'leitura', permissao: 'ia.usar', dadosExternos: false },
      { nome: 'consultar_agente', risco: 'leitura', permissao: 'ia.usar', dadosExternos: false },
      { nome: 'melhorar_texto', risco: 'leitura', permissao: 'ia.criar_conteudo', dadosExternos: false },
      { nome: 'gerar_ata', risco: 'leitura', permissao: 'ia.criar_conteudo', dadosExternos: false },
      { nome: 'gerar_artigo', risco: 'leitura', permissao: 'ia.criar_conteudo', dadosExternos: false },
      { nome: 'salvar_no_repositorio', risco: 'escrita_interna', permissao: 'documentos.enviar', dadosExternos: false },
    ]);
  });

  it('recusa escrita sem resumo para aprovação', () => {
    const escritaSemResumo = {
      todas: () => [
        definirFerramenta({
          nome: 'apagar',
          descricao: 'x',
          esquema: z.object({}),
          risco: 'escrita_externa',
          permissao: 'ia.usar',
          executar: async () => ({ conteudo: '' }),
        }),
      ],
    } as unknown as FerramentasEscrita;
    const vazia = { todas: () => [] } as unknown as FerramentasLeitura;
    expect(() => new RegistroFerramentasService(vazia, escritaSemResumo, semGeracao, semConectores, semWeb)).toThrow(/sem resumo/);
  });

  it('preparar valida e normaliza sem executar, e devolve o resumo', () => {
    const { registro, repositorioOrg } = montar();
    expect(registro.preparar('salvar_no_repositorio', { titulo: '  Plano Q1 ', conteudo: ' # Plano \n' })).toEqual({
      ok: true,
      entrada: { titulo: 'Plano Q1', conteudo: '# Plano' },
      resumo: 'Salvar "Plano Q1.md" no Repositório da organização (7 caracteres).',
    });
    expect(registro.preparar('salvar_no_repositorio', { titulo: 'x' }).ok).toBe(false);
    expect(registro.preparar('nada', {}).ok).toBe(false);
    expect(repositorioOrg.enviar).not.toHaveBeenCalled();
  });

  it('gera definições válidas para os provedores, sem $schema', () => {
    const { registro } = montar();
    const defs = registro.definicoes();
    expect(() => validarFerramentas(defs)).not.toThrow();
    const memoria = defs.find((d) => d.nome === 'buscar_memoria');
    expect(memoria?.parametros).toEqual({
      type: 'object',
      properties: {
        consulta: {
          type: 'string',
          minLength: 2,
          maxLength: 500,
          description: 'O que procurar, em linguagem natural ou palavras-chave.',
        },
      },
      required: ['consulta'],
      additionalProperties: false,
    });
    expect(registro.definicoes(['buscar_web', 'inexistente']).map((d) => d.nome)).toEqual([
      'buscar_web',
    ]);
  });

  it('recusa ferramenta com permissão fora do catálogo ou nome repetido', () => {
    const falsa = (f: Partial<Ferramenta>) =>
      ({ todas: () => [{ ...base, ...f }] }) as unknown as FerramentasLeitura;
    const base = definirFerramenta({
      nome: 'x',
      descricao: 'x',
      esquema: z.object({}),
      risco: 'leitura',
      permissao: 'ia.usar',
      executar: async () => ({ conteudo: '' }),
    });
    expect(() => new RegistroFerramentasService(falsa({ permissao: 'inventada' }), semEscrita, semGeracao, semConectores, semWeb)).toThrow(
      /Permissão desconhecida/,
    );
    const dupla = { todas: () => [base, base] } as unknown as FerramentasLeitura;
    expect(() => new RegistroFerramentasService(dupla, semEscrita, semGeracao, semConectores, semWeb)).toThrow(/duas vezes/);
  });

  describe('executar nunca lança', () => {
    it('ferramenta desconhecida', async () => {
      const { registro } = montar();
      expect(await registro.executar('apagar_tudo', {}, ctx)).toEqual({
        ok: false,
        erro: 'Ferramenta desconhecida: apagar_tudo.',
      });
    });

    it('argumentos inválidos voltam explicados, sem executar', async () => {
      const { registro, prompt } = montar();
      const r = await registro.executar('buscar_memoria', { consulta: 'x', extra: 1 }, ctx);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.erro).toMatch(/Argumentos inválidos para buscar_memoria/);
      expect(prompt.recuperarMemoria).not.toHaveBeenCalled();
    });

    it('HttpException passa a mensagem; erro interno vira mensagem genérica', async () => {
      const { registro, prompt } = montar();
      prompt.recuperarMemoria.mockRejectedValueOnce(
        new ServiceUnavailableException('Nenhuma IA conectada.'),
      );
      expect(await registro.executar('buscar_memoria', { consulta: 'café' }, ctx)).toEqual({
        ok: false,
        erro: 'Nenhuma IA conectada.',
      });
      prompt.recuperarMemoria.mockRejectedValueOnce(new Error('senha do banco: xyz'));
      expect(await registro.executar('buscar_memoria', { consulta: 'café' }, ctx)).toEqual({
        ok: false,
        erro: 'Falha interna ao executar buscar_memoria.',
      });
    });

    it('ErroFerramenta passa a mensagem para o modelo', async () => {
      const { registro, prompt } = montar();
      prompt.recuperarMemoria.mockRejectedValueOnce(new ErroFerramenta('tente outra consulta'));
      expect(await registro.executar('buscar_memoria', { consulta: 'café' }, ctx)).toEqual({
        ok: false,
        erro: 'tente outra consulta',
      });
    });

    it('corta resultados grandes demais', async () => {
      const { registro, prompt } = montar();
      prompt.recuperarMemoria.mockResolvedValue({
        bloco: 'a'.repeat(MAX_CONTEUDO_FERRAMENTA + 10),
        titulos: [],
      });
      const r = await registro.executar('buscar_memoria', { consulta: 'café' }, ctx);
      expect(r.ok && r.conteudo.endsWith('[Resultado cortado por tamanho.]')).toBe(true);
      expect(r.ok && r.conteudo.length).toBeLessThan(MAX_CONTEUDO_FERRAMENTA + 50);
    });
  });
});

describe('ferramentas de geração', () => {
  it('melhorar_texto usa o mesmo gerador do AI Studio, no repositório do contexto', async () => {
    const { registro, geradores } = montar();
    const r = await registro.executar('melhorar_texto', { texto: ' rascunho ', instrucoes: 'formal' }, ctx);
    expect(geradores.melhorar).toHaveBeenCalledWith(ctx.user, 'repo1', { texto: 'rascunho', instrucoes: 'formal' });
    expect(r).toEqual({ ok: true, conteudo: 'Texto bom.\n\nO que mudou: Mais direto.', fontes: [] });
  });

  it('gerar_ata nunca usa o formato da Memória (frontmatter) no chat', async () => {
    const { registro, geradores } = montar();
    const r = await registro.executar('gerar_ata', { conteudo: 'reunião: decidimos A' }, ctx);
    expect(geradores.ata).toHaveBeenCalledWith(ctx.user, 'repo1', {
      conteudo: 'reunião: decidimos A',
      instrucoes: undefined,
      memoria: false,
    });
    expect(r).toEqual({ ok: true, conteudo: '# Ata 10/11\n\n- Decisão A', fontes: [] });
  });

  it('gerar_artigo: diretrizes só quando pedido', async () => {
    const { registro, geradores } = montar();
    await registro.executar('gerar_artigo', { tema: 'IA no varejo' }, ctx);
    expect(geradores.artigo.mock.calls[0][2].fontes).toEqual([]);
    const r = await registro.executar('gerar_artigo', { tema: 'IA no varejo', usarDiretrizes: true }, ctx);
    expect(geradores.artigo.mock.calls[1][2].fontes).toEqual(['memoria']);
    expect(r).toEqual({ ok: true, conteudo: '# IA\n\n_no varejo_\n\nCorpo.', fontes: [] });
  });

  it('erro do gerador (ex.: texto vazio) volta como mensagem ao modelo', async () => {
    const { registro } = montar();
    const r = await registro.executar('melhorar_texto', { texto: '' }, ctx);
    expect(r.ok).toBe(false);
  });
});

describe('salvar_no_repositorio', () => {
  it('salva o Markdown no Repositório da organização do contexto', async () => {
    const { registro, repositorioOrg } = montar();
    const r = await registro.executar(
      'salvar_no_repositorio',
      { titulo: 'Plano', conteudo: '# Plano\nfazer X' },
      ctx,
    );
    expect(repositorioOrg.enviar).toHaveBeenCalledWith('e1', 'org1', 'u1', {
      originalname: 'Plano.md',
      buffer: Buffer.from('# Plano\nfazer X', 'utf8'),
      size: 15,
    });
    expect(r).toEqual({
      ok: true,
      conteudo: 'Documento salvo no Repositório da organização: "Plano.md".',
      fontes: [],
    });
  });

  it('sem organização ativa não salva e explica ao modelo', async () => {
    const { registro, repositorioOrg } = montar();
    const r = await registro.executar(
      'salvar_no_repositorio',
      { titulo: 'Plano', conteudo: 'x' },
      { ...ctx, organizacaoId: null },
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/Não há organização ativa/);
    expect(repositorioOrg.enviar).not.toHaveBeenCalled();
  });

  it.each([
    ['../../etc/passwd', '.. .. etc passwd.md'],
    ['Plano.md', 'Plano.md'],
    ['  ', 'Documento.md'],
    ['a:b*c?"d<e>f|g', 'a b c d e f g.md'],
  ])('nome seguro: %j → %j', (titulo, nome) => {
    expect(nomeDoDocumento(titulo)).toBe(nome);
  });
});

describe('ferramentas de leitura', () => {
  it('buscar_memoria usa a mesma busca do Assistente, no escopo do contexto', async () => {
    const { registro, prompt } = montar();
    prompt.recuperarMemoria.mockResolvedValue({ bloco: '### Nota A\ncafé', titulos: ['Nota A'] });
    const r = await registro.executar('buscar_memoria', { consulta: '  café  ' }, ctx);
    expect(prompt.recuperarMemoria).toHaveBeenCalledWith(ctx.user, 'org1', 'repo1', 'café');
    expect(r).toEqual({ ok: true, conteudo: '### Nota A\ncafé', fontes: ['Nota A'] });
  });

  it('buscar_memoria sem resultado diz isso ao modelo', async () => {
    const { registro, prompt } = montar();
    prompt.recuperarMemoria.mockResolvedValue({ bloco: '', titulos: [] });
    const r = await registro.executar('buscar_memoria', { consulta: 'nada' }, ctx);
    expect(r).toEqual({ ok: true, conteudo: 'Nenhuma nota encontrada para esta consulta.', fontes: [] });
  });

  it('buscar_web devolve o resumo com as fontes listadas', async () => {
    const { registro, ai } = montar();
    ai.completarWeb.mockResolvedValue({
      text: 'Dólar a R$ 5.',
      fontes: [{ titulo: 'BC', url: 'https://bcb.gov.br' }],
      truncated: false,
    });
    const r = await registro.executar('buscar_web', { consulta: 'cotação do dólar' }, ctx);
    expect(ai.completarWeb).toHaveBeenCalledWith(
      'e1',
      'u1',
      expect.stringContaining('assistente de pesquisa'),
      '## PERGUNTA\ncotação do dólar',
      2000,
    );
    expect(r).toEqual({
      ok: true,
      conteudo: 'Dólar a R$ 5.\n\nFontes:\n- BC: https://bcb.gov.br',
      fontes: [{ titulo: 'BC', url: 'https://bcb.gov.br' }],
    });
  });

  it('listar_agentes mostra os agentes que o usuário vê', async () => {
    const { registro, agentes } = montar();
    const r = await registro.executar('listar_agentes', {}, ctx);
    expect(agentes.sistemaDaOrganizacao).toHaveBeenCalledWith('e1', 'org1');
    expect(agentes.meus).toHaveBeenCalledWith('e1', 'u1');
    expect(agentes.daOrganizacao).toHaveBeenCalledWith('e1', 'org1');
    expect(r).toEqual({
      ok: true,
      conteudo:
        '- id: s1 | @Estratégia | Estratégia (sistema) — decisões\n' +
        '- id: p1 | @Revisor | Revisor (pessoal)',
      fontes: [],
    });
  });

  it('agentes do sistema ocultos na interface não são oferecidos nem consultáveis', async () => {
    const { registro, ai } = montar();
    const oculto = { ...ctx, agentesSistema: ['outro'] };
    const lista = await registro.executar('listar_agentes', {}, oculto);
    expect(lista).toEqual({ ok: true, conteudo: '- id: p1 | @Revisor | Revisor (pessoal)', fontes: [] });
    const r = await registro.executar('consultar_agente', { agenteId: 's1', pergunta: 'oi?' }, oculto);
    expect(r.ok).toBe(false);
    expect(ai.completar).not.toHaveBeenCalled();
  });

  it('consultar_agente responde com a persona e o enquadramento de consulta', async () => {
    const { registro, ai } = montar();
    ai.personaDoAgente.mockResolvedValue({ id: 's1', titulo: 'Estratégia', texto: 'PERSONA' });
    const r = await registro.executar(
      'consultar_agente',
      { agenteId: 's1', pergunta: 'Vale abrir filial?', contexto: 'Vendas subiram 20%.' },
      ctx,
    );
    expect(ai.personaDoAgente).toHaveBeenCalledWith('s1', {
      empresaId: 'e1',
      usuarioId: 'u1',
      organizacaoId: 'org1',
    });
    expect(ai.completar).toHaveBeenCalledWith(
      'e1',
      'u1',
      `PERSONA\n\n---\n${SYSTEM_CONSULTA_AGENTE}`,
      '## CONTEXTO\nVendas subiram 20%.\n\n## PERGUNTA\nVale abrir filial?',
      2000,
      'agente',
    );
    expect(r).toEqual({ ok: true, conteudo: 'Resposta de Estratégia:\nParecer.', fontes: [] });
  });

  it('consultar_agente recusa agente fora da lista visível, sem chamar a IA', async () => {
    const { registro, ai } = montar();
    // Ex.: agente do sistema que a organização excluiu — personaDoAgente ainda
    // o resolveria pelo id, por isso a checagem vem antes.
    ai.personaDoAgente.mockResolvedValue({ id: 'sx', titulo: 'Excluído', texto: 'P' });
    const r = await registro.executar('consultar_agente', { agenteId: 'sx', pergunta: 'oi?' }, ctx);
    expect(r).toEqual({
      ok: false,
      erro: 'Agente sx não existe ou não está disponível para este usuário. Use listar_agentes.',
    });
    expect(ai.personaDoAgente).not.toHaveBeenCalled();
    expect(ai.completar).not.toHaveBeenCalled();
  });
});
