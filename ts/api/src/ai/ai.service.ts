import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { getProvider, type LlmWebResult } from './providers';
import { AiConnectionsService } from './connections.service';
import {
  ehChaveRejeitada,
  ehFalhaDeProvedor,
  statusDoErro,
} from './falha-provedor';
import { blocoTitulosVault, REGRA_CONEXOES_VAULT } from './conexoes-vault';
import { VaultService } from '@/vault/vault.service';
import { UsoTokensService } from '@/uso/uso-tokens.service';
import { MemoriasService } from '@/memorias/memorias.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatInput {
  empresaId: string;
  usuarioId: string;
  squadId: string;
  agentId?: string;
  messages: ChatTurn[];
}

/** Um modelo candidato a atender a chamada, na ordem de prioridade do tenant. */
interface CandidatoIa {
  /** Id da conexão BYOK; ausente no modo gerenciado (trial). */
  id?: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
  managed: boolean;
}

/** Enquadramento da plataforma, anexado ao prompt da persona. */
const PLATFORM_FRAMING = `Você atua dentro do beculture, uma plataforma de inteligência de pessoas para líderes e CEOs.
Responda em português do Brasil, de forma prática, estruturada e objetiva.
Quando fizer sentido, finalize com recomendações acionáveis e próximos passos.
Não invente métricas, dados de conectores ou fatos que não tenham sido fornecidos no contexto.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly connections: AiConnectionsService,
    private readonly uso: UsoTokensService,
    private readonly vault: VaultService,
    private readonly memorias: MemoriasService,
  ) {}

  /**
   * Anexa as DIRETRIZES ativas do tenant ao fim do system prompt. Toda chamada
   * de IA passa por aqui (chat de squad, completar e completarWeb), então uma
   * diretriz criada na tela Diretrizes vale para qualquer coisa que a IA
   * produza — não só para o chat. Fica no fim de propósito: é a última coisa
   * que o modelo lê antes da tarefa, o que reforça a precedência das regras.
   *
   * Se a consulta ao banco falhar, a chamada segue sem as diretrizes: melhor
   * responder sem os guardrails do que derrubar a funcionalidade inteira.
   */
  private async comDiretrizes(
    empresaId: string,
    system: string,
  ): Promise<string> {
    try {
      const bloco = await this.memorias.blocoSystem(empresaId);
      return bloco ? `${system}\n\n${bloco}` : system;
    } catch (err) {
      this.logger.warn(`Falha ao carregar Diretrizes: ${String(err)}`);
      return system;
    }
  }

  /** Monta o system prompt: persona do agente, ou nível-squad. Lê do catálogo no banco. */
  private async buildSystem(input: ChatInput): Promise<string> {
    const squad = await this.prisma.squad.findFirst({
      where: { id: input.squadId, active: true },
      include: {
        agents: { where: { active: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!squad) {
      throw new NotFoundException('Squad não encontrado.');
    }

    // A resposta do squad pode ser salva como documento/nota na Memória: fecha
    // com o bloco de conexões, ligando-a às notas que já existem no vault.
    const conexoes = await this.buildConexoesContext(input);

    if (input.agentId) {
      const agent = squad.agents.find((a) => a.id === input.agentId);
      if (agent) {
        return `${agent.prompt}\n\n---\n${PLATFORM_FRAMING}${conexoes}`;
      }
    }

    const conselheiros = squad.agents
      .map((a) => `- ${a.reference} (${a.position}): ${a.contribution}`)
      .join('\n');
    return `Você responde como a inteligência consolidada deste squad: uma única voz que já integrou internamente o conhecimento dos conselheiros abaixo. Eles são seu repertório interno — o usuário NÃO quer ouvir a opinião de cada um separadamente.
Quando utilizar este squad: ${squad.description}

Repertório interno do squad (não enderece um por um):
${conselheiros}

Como responder:
- Entregue UMA resposta única, direta e resumida — sem seções por conselheiro, sem "Fulano diria...", sem listar a contribuição de cada membro.
- Sintetize os pontos em comum e resolva as divergências relevantes, em vez de enumerá-las.
- Mencione o nome de um conselheiro apenas quando uma perspectiva específica for decisiva (no máximo um ou dois, de passagem).
- Priorize a concisão: vá ao ponto e termine com os próximos passos práticos.

---
${PLATFORM_FRAMING}${conexoes}`;
  }

  /**
   * Regra do bloco "🔗 Conexões no Vault" + os títulos das notas do vault que
   * conversam com a pergunta atual (alvos possíveis dos [[wikilinks]]). Se o
   * vault não estiver acessível, a regra vale mesmo assim — o modelo cria os
   * links marcados como "(novo)".
   */
  private async buildConexoesContext(input: ChatInput): Promise<string> {
    const ultima = [...input.messages].reverse().find((m) => m.role === 'user');
    let titulos: string[] = [];
    try {
      titulos = await this.vault.titulos(input.empresaId, ultima?.text ?? '', 40);
    } catch {
      /* sem vault sincronizado: segue só com a regra */
    }
    return `\n${REGRA_CONEXOES_VAULT}\n${blocoTitulosVault(titulos)}`;
  }

  /**
   * Resolve os modelos de IA do tenant em ordem de prioridade:
   * 1) Conexões BYOK da empresa (a fila definida em Configurações → IA); senão
   * 2) Modo gerenciado: nossa chave Anthropic, apenas enquanto o trial está ativo.
   *
   * A ordem importa: o primeiro é o principal e os seguintes são os reservas do
   * failover — se um modelo cair, o próximo assume.
   */
  private async resolveCandidatos(empresaId: string): Promise<CandidatoIa[]> {
    const conns = await this.connections.listDecrypted(empresaId);
    if (conns.length > 0) {
      return conns.map((c) => ({ ...c, managed: false }));
    }

    const managedKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (managedKey) {
      const assinatura = await this.prisma.assinatura.findUnique({
        where: { empresaId },
      });
      const trialAtivo =
        !!assinatura &&
        assinatura.status === 'trial' &&
        assinatura.trialEndsAt.getTime() > Date.now();
      if (trialAtivo) {
        return [
          {
            provider: 'anthropic',
            model: this.config.get<string>('AI_MODEL', 'claude-opus-4-8'),
            apiKey: managedKey,
            managed: true,
          },
        ];
      }
    }

    throw new ServiceUnavailableException(
      'Nenhuma IA conectada. Conecte um provedor de IA em Conexões.',
    );
  }

  /**
   * Executa a chamada no primeiro modelo da fila e, se ele falhar por culpa do
   * provedor, tenta o próximo. Se todos falharem, traduz o último erro.
   */
  private async comFailover<T>(
    empresaId: string,
    executar: (candidato: CandidatoIa) => Promise<T>,
  ): Promise<T> {
    const candidatos = await this.resolveCandidatos(empresaId);
    let ultimoErro: unknown;

    for (let i = 0; i < candidatos.length; i++) {
      const candidato = candidatos[i];
      try {
        return await executar(candidato);
      } catch (err) {
        ultimoErro = err;
        const tentarProximo =
          ehFalhaDeProvedor(err) && i < candidatos.length - 1;
        this.registrarFalha(candidato, err, tentarProximo);
        if (!tentarProximo) break;
      }
    }

    this.traduzErroProvedor(ultimoErro);
  }

  /**
   * Loga a falha de um modelo da fila e, quando o provedor rejeitou a chave,
   * marca a conexão como inválida para a interface sinalizar ao usuário.
   */
  private registrarFalha(
    candidato: CandidatoIa,
    err: unknown,
    tentarProximo: boolean,
  ): void {
    const status = statusDoErro(err);
    this.logger.warn(
      `Falha em ${candidato.provider}/${candidato.model}` +
        (status ? ` (HTTP ${status})` : '') +
        (tentarProximo
          ? ': tentando o próximo modelo da fila.'
          : ': sem outro modelo para assumir.'),
    );
    if (candidato.id && ehChaveRejeitada(err)) {
      void this.connections.marcarInvalida(candidato.id);
    }
  }

  /**
   * Gera a resposta do agente em streaming (chunks de texto). O failover só
   * acontece ANTES do primeiro chunk: depois que o cliente já recebeu texto,
   * não há como rebobinar a resposta, então o erro é propagado.
   */
  async *chatStream(input: ChatInput): AsyncGenerator<string> {
    const messages = input.messages.filter((m) => m.text && m.text.trim());
    if (messages.length === 0) {
      throw new BadRequestException('Envie ao menos uma mensagem.');
    }

    const system = await this.comDiretrizes(
      input.empresaId,
      await this.buildSystem(input),
    );
    const candidatos = await this.resolveCandidatos(input.empresaId);
    let ultimoErro: unknown;

    for (let i = 0; i < candidatos.length; i++) {
      const candidato = candidatos[i];
      let emitiu = false;
      try {
        const stream = getProvider(candidato.provider).streamChat({
          apiKey: candidato.apiKey,
          model: candidato.model,
          system,
          messages,
          onUsage: (u) =>
            this.uso.registrar({
              empresaId: input.empresaId,
              usuarioId: input.usuarioId,
              entrada: u.entrada,
              saida: u.saida,
              fonte: 'chat',
            }),
        });
        for await (const chunk of stream) {
          emitiu = true;
          yield chunk;
        }
        return;
      } catch (err) {
        ultimoErro = err;
        const tentarProximo =
          !emitiu && ehFalhaDeProvedor(err) && i < candidatos.length - 1;
        this.registrarFalha(candidato, err, tentarProximo);
        if (!tentarProximo) break;
      }
    }

    this.traduzErroProvedor(ultimoErro);
  }

  /**
   * Traduz erros do provedor de IA (SDK Anthropic/OpenAI) em mensagens claras
   * para o usuário. Sem isto, uma chave inválida ou modelo indisponível vira um
   * 500 opaco ("Erro na busca") sem pista do que corrigir. Só é chamado depois
   * que TODOS os modelos da fila falharam.
   */
  private traduzErroProvedor(err: unknown): never {
    const status = statusDoErro(err);
    if (status === 401 || status === 403) {
      throw new ServiceUnavailableException(
        'A chave de IA conectada é inválida ou sem permissão. Reconecte o provedor em Conexões.',
      );
    }
    if (status === 429) {
      throw new ServiceUnavailableException(
        'Limite de uso da IA atingido no provedor. Tente novamente em instantes.',
      );
    }
    if (status === 404) {
      throw new ServiceUnavailableException(
        'O modelo de IA configurado não está disponível. Verifique o modelo em Conexões.',
      );
    }
    const msg = err instanceof Error ? err.message : 'erro desconhecido';
    throw new ServiceUnavailableException(`Falha ao consultar a IA: ${msg}`);
  }

  /**
   * Resposta única (não-streaming) usada por relatórios longos — ex.: a Análise
   * de conteúdo. Percorre a fila de modelos do tenant com failover e chama o
   * provedor com um limite de tokens maior que o chat.
   */
  async completar(
    empresaId: string,
    usuarioId: string,
    system: string,
    user: string,
    maxTokens = 16000,
    fonte = 'completar',
    /**
     * `semDiretrizes` só para chamadas internas que não produzem texto para o
     * usuário (ex.: o classificador de rota do Prompt, que responde uma única
     * palavra). Em tudo que vira resposta, as diretrizes entram.
     */
    opts: { semDiretrizes?: boolean } = {},
  ): Promise<{ text: string; truncated: boolean }> {
    const systemFinal = opts.semDiretrizes
      ? system
      : await this.comDiretrizes(empresaId, system);
    const result = await this.comFailover(empresaId, (candidato) =>
      getProvider(candidato.provider).complete({
        apiKey: candidato.apiKey,
        model: candidato.model,
        system: systemFinal,
        user,
        maxTokens,
      }),
    );
    if (result.usage) {
      this.uso.registrar({
        empresaId,
        usuarioId,
        entrada: result.usage.entrada,
        saida: result.usage.saida,
        fonte,
      });
    }
    return { text: result.text, truncated: result.truncated };
  }

  /**
   * Resposta única com busca na web (fontes citadas) — usada pelo modo "Web" do
   * Prompt. Se o provedor do tenant não oferece busca (ex.: OpenAI aqui), cai
   * numa resposta comum sem fontes, apenas com o conhecimento do modelo.
   */
  async completarWeb(
    empresaId: string,
    usuarioId: string,
    system: string,
    user: string,
    maxTokens = 4000,
  ): Promise<LlmWebResult> {
    const systemFinal = await this.comDiretrizes(empresaId, system);
    const result = await this.comFailover(empresaId, (candidato) => {
      const provider = getProvider(candidato.provider);
      const params = {
        apiKey: candidato.apiKey,
        model: candidato.model,
        system: systemFinal,
        user,
        maxTokens,
      };
      return provider.completeWeb
        ? provider.completeWeb(params)
        : provider.complete(params).then(
            (r): LlmWebResult => ({
              text: r.text,
              fontes: [],
              truncated: r.truncated,
              usage: r.usage,
            }),
          );
    });
    if (result.usage) {
      this.uso.registrar({
        empresaId,
        usuarioId,
        entrada: result.usage.entrada,
        saida: result.usage.saida,
        fonte: 'web',
      });
    }
    return result;
  }
}
