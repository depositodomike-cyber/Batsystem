import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { extrairTexto } from './analise/extrair-texto';
import {
  buildVaultUser,
  buildWebUser,
  extrairFontesVault,
  montarBlocoMemoria,
  MEMORIA_MAX_NOTAS,
  SYSTEM_ROTA,
  SYSTEM_VAULT,
  SYSTEM_WEB,
  type HistoricoTurno,
  type ModoBusca,
} from './prompt/framework';
import {
  extrairArquivos,
  REGRA_ARQUIVO,
  type ArquivoConversa,
} from './prompt/arquivos';
import { VaultService } from '@/vault/vault.service';
import { RepositorioOrgService } from '@/repositorio-org/repositorio-org.service';
import { ConversasService } from '@/conversas/conversas.service';
import { PerfilService, PASTA_PERFIL } from '@/perfil/perfil.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/** Fonte da resposta: caminho/título (Memória) ou página web citada. */
export type Fonte = string | { titulo: string; url: string };

export interface AgenteDoTurno {
  id: string;
  titulo: string;
}

export interface MencaoAgente {
  id: string;
  titulo: string;
  mencao: string;
}

export interface PromptResposta {
  tipo: 'resposta';
  resposta: string;
  fontes: Fonte[];
  origem: 'vault' | 'web';
  conversaId?: string;
  /** Mensagem da resposta, para o cliente marcar um arquivo como salvo. */
  mensagemId?: string;
  /** Agente que produziu esta resposta (null = Assistente padrão). */
  agente: AgenteDoTurno | null;
  /** Arquivos gerados nesta resposta — pertencem à conversa. */
  arquivos: ArquivoConversa[];
}

/**
 * Uma pergunta ao Assistente, já fora do HTTP (corpo parseado). É a entrada
 * que o orquestrador também vai usar para o caminho de "resposta direta".
 */
export interface PerguntaPrompt {
  user: AuthenticatedUser;
  texto: string;
  /** 'vault' | 'web' | 'auto'; qualquer outro valor vira 'vault'. */
  modo?: string;
  historico: HistoricoTurno[];
  /** Notas/To-do's coletados no cliente. */
  referencia?: string;
  conversaId?: string;
  /** Repositório ativo, já resolvido (corpo ou header). */
  repositorioId?: string;
  /** Organização ativa (header). */
  organizacaoId: string | null;
  /**
   * Agente (o antigo "squad") que participa deste turno. Ausente = o
   * Assistente padrão. O agente só muda a voz e a especialização: o contexto
   * (Repositório, vault, referências) continua o do usuário — agente não
   * eleva permissão.
   */
  agenteId?: string;
  /** Agentes mencionados na pergunta (vão para o `meta` da mensagem do usuário). */
  mencoes: MencaoAgente[];
  /**
   * Este turno é a resposta de MAIS UM agente à mesma pergunta: grava só a
   * resposta. Só vale com conversa existente.
   */
  respostaAdicional: boolean;
  arquivo?: UploadedFileLike;
}

/**
 * "Pergunte à sua Memória" (portado do Oracle/Confi): uma pergunta, uma
 * resposta, nos modos Memória, Web ou Auto. Saiu do PromptController para
 * poder ser chamado por outros pontos do backend sem passar pelo HTTP.
 */
@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  constructor(
    private readonly ai: AiService,
    private readonly vault: VaultService,
    private readonly repositorioOrg: RepositorioOrgService,
    private readonly conversas: ConversasService,
    private readonly perfil: PerfilService,
  ) {}

  async responder(p: PerguntaPrompt): Promise<PromptResposta> {
    const { user, organizacaoId, arquivo, historico } = p;
    const texto = (p.texto || '').trim();
    if (!texto) {
      throw new BadRequestException('Pergunta vazia.');
    }

    let modo: ModoBusca = (['vault', 'web', 'auto'] as const).includes(
      (p.modo || '').trim() as ModoBusca,
    )
      ? ((p.modo as string).trim() as ModoBusca)
      : 'vault';

    const referencia = (p.referencia || '').trim();
    const conversaIdIn = (p.conversaId || '').trim() || undefined;
    const repositorioId = p.repositorioId || undefined;
    const modoPedido = modo;

    // Agente do turno: a persona vai NA FRENTE do system prompt do modo; as
    // regras de formato (Conexões, FONTES) seguem as mesmas. Agente inválido ou
    // inativo cai no Assistente padrão em vez de derrubar a pergunta.
    const agenteIdIn = (p.agenteId || '').trim();
    const persona = agenteIdIn
      ? await this.ai
          // Com o dono: agente personalizado só resolve se for DESTE usuário
          // ou da organização ativa.
          .personaDoAgente(agenteIdIn, {
            empresaId: user.empresaId,
            usuarioId: user.id,
            organizacaoId,
          })
          .catch((err: unknown) => {
            this.logger.warn(`Falha ao carregar o agente: ${String(err)}`);
            return null;
          })
      : null;
    const agente: AgenteDoTurno | null = persona
      ? { id: persona.id, titulo: persona.titulo }
      : null;
    const mencoes = p.mencoes;
    const respostaAdicional = p.respostaAdicional && !!conversaIdIn;
    const comAgente = (system: string) =>
      persona ? `${persona.texto}\n\n---\n${system}${REGRA_ARQUIVO}` : system;
    // O arquivo pertence à conversa, mas registra QUEM o gerou.
    const separarArquivos = (bruta: string) => {
      if (!persona) {
        return { resposta: bruta, arquivos: [] as ArquivoConversa[] };
      }
      const r = extrairArquivos(bruta);
      return {
        resposta: r.resposta,
        arquivos: r.arquivos.map((a) => ({ ...a, geradoPor: agente })),
      };
    };

    // Modo Auto: o modelo decide entre Memória e Web.
    if (modo === 'auto') {
      try {
        // Sem diretrizes: este passo não gera resposta, só escolhe a fonte —
        // e as regras de conduta atrapalhariam a saída de uma palavra só.
        const cls = await this.ai.completar(
          user.empresaId,
          user.id,
          SYSTEM_ROTA,
          texto,
          8,
          'completar',
          { semDiretrizes: true },
        );
        modo = /web/i.test(cls.text) ? 'web' : 'vault';
      } catch (err) {
        this.logger.warn(`Falha ao classificar rota (Auto), assumindo Memória: ${String(err)}`);
        modo = 'vault';
      }
    }

    // Modo Web: busca na internet com fontes citadas. Anexo é ignorado no Web
    // (igual ao Confi).
    if (modo === 'web') {
      const { text, fontes, truncated } = await this.ai.completarWeb(
        user.empresaId,
        user.id,
        comAgente(SYSTEM_WEB),
        buildWebUser({
          texto,
          historico,
          perfil: (await this.perfil.trechosRelevantes(user.id, texto))
            .map((h) => h.conteudo)
            .join('\n'),
        }),
        4000,
      );
      const separado = separarArquivos(text.trim());
      let resposta = separado.resposta;
      if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
      const salvo = await this.persistirPrompt({
        user,
        conversaId: conversaIdIn,
        repositorioId,
        modo: modoPedido,
        pergunta: texto,
        resposta,
        fontes,
        origem: 'web',
        agente,
        arquivos: separado.arquivos,
        mencoes,
        respostaAdicional,
      });
      return {
        tipo: 'resposta',
        resposta,
        fontes,
        origem: 'web',
        ...salvo,
        agente,
        arquivos: separado.arquivos,
      };
    }

    // Modo Memória (vault): referência do cliente + anexo opcional (arquivo de
    // texto lido aqui e injetado no contexto). As DIRETRIZES não são montadas
    // aqui: o AiService as anexa ao system prompt de toda chamada de IA.
    let anexo = '';
    if (arquivo) {
      try {
        anexo = (await extrairTexto(arquivo.buffer, arquivo.originalname)).trim();
      } catch (err) {
        this.logger.warn(`Falha ao ler anexo do Prompt: ${String(err)}`);
      }
    }

    const { bloco: notasBloco, titulos: titulosNotas } = await this.recuperarMemoria(
      user,
      organizacaoId,
      repositorioId ?? null,
      texto,
    );

    const userPrompt = buildVaultUser({
      texto,
      notasBloco,
      referencia,
      anexo,
      anexoNome: arquivo?.originalname,
      historico,
    });

    const { text, truncated } = await this.ai.completar(
      user.empresaId,
      user.id,
      comAgente(SYSTEM_VAULT),
      userPrompt,
      4000,
    );

    const { resposta: limpa, fontes: citadas } = extrairFontesVault(text);
    // Só devolvemos como fonte títulos de notas que existem de fato (o modelo
    // pode alucinar nomes). Se nada casou, não mostramos fontes.
    const setNotas = new Set(titulosNotas.map((t) => t.toLowerCase()));
    const fontes: Fonte[] = citadas.filter((c) => setNotas.has(c.toLowerCase()));
    if (anexo && arquivo) fontes.unshift(`Anexo: ${arquivo.originalname}`);

    const { resposta: semArquivos, arquivos } = separarArquivos(limpa);
    let resposta = semArquivos;
    if (truncated) resposta += '\n\n> ⚠️ Resposta truncada por tamanho.';
    const salvo = await this.persistirPrompt({
      user,
      conversaId: conversaIdIn,
      repositorioId,
      modo: modoPedido,
      pergunta: texto,
      resposta,
      fontes,
      origem: 'vault',
      agente,
      arquivos,
      mencoes,
      respostaAdicional,
    });
    return {
      tipo: 'resposta',
      resposta,
      fontes,
      origem: 'vault',
      ...salvo,
      agente,
      arquivos,
    };
  }

  /**
   * MEMÓRIA = notas .md do usuário (vault), recuperadas por relevância à
   * pergunta via busca textual do Postgres. É a base de conhecimento factual.
   * O bloco é o maior do prompt: `montarBlocoMemoria` recorta o trecho
   * relevante de cada nota sob um orçamento total de contexto (ver framework).
   *
   * Os documentos do Repositório da ORGANIZAÇÃO entram no mesmo bloco, na
   * frente: só voltam quando casam com a pergunta (sem fallback), enquanto
   * as notas do vault podem ser só "as mais recentes". Listagem ≠ contexto:
   * eles não aparecem na lista nem no grafo pessoal, mas a IA os lê.
   *
   * Nunca lança: sem memória, a pergunta segue com o bloco vazio. Pública
   * porque a ferramenta `buscar_memoria` do orquestrador usa a mesma busca.
   */
  async recuperarMemoria(
    user: AuthenticatedUser,
    organizacaoId: string | null,
    repositorioId: string | null,
    texto: string,
  ): Promise<{ bloco: string; titulos: string[] }> {
    try {
      // Busca uma margem além do teto para o orçamento poder escolher.
      const [doPerfil, daOrganizacao, doVault] = await Promise.all([
        // Perfil Pessoal: do USUÁRIO (vale em qualquer organização), só os
        // fatos que casam com a pergunta — nunca o perfil inteiro.
        this.perfil.trechosRelevantes(user.id, texto),
        this.repositorioOrg
          .search(user.empresaId, organizacaoId, texto)
          .catch((err: unknown) => {
            this.logger.warn(
              `Falha ao buscar no Repositório da organização: ${String(err)}`,
            );
            return [];
          }),
        this.vault.search(user.empresaId, repositorioId, texto, MEMORIA_MAX_NOTAS + 2),
      ]);
      // As cópias dos .md do perfil no índice saem: o perfil já entrou acima,
      // recortado, direto da fonte da verdade.
      const hits = [
        ...doPerfil,
        ...daOrganizacao,
        ...doVault.filter((n) => !n.path.startsWith(`${PASTA_PERFIL}/`)),
      ];
      return montarBlocoMemoria(hits, texto);
    } catch (err) {
      this.logger.warn(`Falha ao recuperar notas do Vault: ${String(err)}`);
      return { bloco: '', titulos: [] };
    }
  }

  private async persistirPrompt(params: {
    user: AuthenticatedUser;
    conversaId?: string;
    repositorioId?: string;
    modo: ModoBusca;
    pergunta: string;
    resposta: string;
    fontes: Fonte[];
    origem: 'vault' | 'web';
    agente: AgenteDoTurno | null;
    arquivos: ArquivoConversa[];
    mencoes: MencaoAgente[];
    respostaAdicional: boolean;
  }): Promise<{ conversaId?: string; mensagemId?: string }> {
    try {
      const { conversaId, nova, mensagemId } = await this.conversas.persistPromptTurn({
        empresaId: params.user.empresaId,
        usuarioId: params.user.id,
        conversaId: params.conversaId,
        repositorioId: params.repositorioId,
        modo: params.modo,
        pergunta: params.pergunta,
        resposta: params.resposta,
        fontes: params.fontes,
        origemResposta: params.origem,
        agente: params.agente,
        arquivos: params.arquivos,
        mencoes: params.mencoes,
        respostaAdicional: params.respostaAdicional,
      });
      if (nova) this.refinarTitulo(params.user, conversaId, params.pergunta, params.resposta);
      return { conversaId, mensagemId };
    } catch (err) {
      this.logger.warn(`Falha ao persistir conversa do Prompt: ${String(err)}`);
      return { conversaId: params.conversaId };
    }
  }

  /**
   * Troca o título provisório (início da pergunta) por um resumo de 4 a 6
   * palavras, em segundo plano. Público para o orquestrador fazer o mesmo
   * com as conversas que ele cria.
   */
  refinarTitulo(
    user: AuthenticatedUser,
    conversaId: string,
    pergunta: string,
    resposta: string,
  ): void {
    void this.ai
      .completar(
        user.empresaId,
        user.id,
        'Responda somente com um título curto de 4 a 6 palavras, em português, sem aspas e sem pontuação final, que resuma a conversa.',
        `Pergunta: ${pergunta}\nResposta: ${resposta.slice(0, 500)}`,
        24,
        'completar',
        { semDiretrizes: true },
      )
      .then(async (r) => {
        const titulo = r.text
          .trim()
          .replace(/^["'«»]+|["'«»]+$/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        if (titulo.length < 3) return;
        await this.conversas.rename(user.empresaId, user.id, conversaId, titulo);
      })
      .catch((err) => {
        this.logger.warn(`Falha ao gerar título da conversa: ${String(err)}`);
      });
  }
}
