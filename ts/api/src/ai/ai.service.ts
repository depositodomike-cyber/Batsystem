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
   * Resolve as credenciais de IA do tenant:
   * 1) Conexão BYOK da empresa (provedor + chave do cliente); senão
   * 2) Modo gerenciado: nossa chave Anthropic, apenas enquanto o trial está ativo.
   */
  private async resolveCreds(empresaId: string): Promise<{
    provider: AiProvider;
    model: string;
    apiKey: string;
    managed: boolean;
  }> {
    const conn = await this.connections.getDecrypted(empresaId);
    if (conn) {
      return { ...conn, managed: false };
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
        return {
          provider: 'anthropic',
          model: this.config.get<string>('AI_MODEL', 'claude-opus-4-8'),
          apiKey: managedKey,
          managed: true,
        };
      }
    }

    throw new ServiceUnavailableException(
      'Nenhuma IA conectada. Conecte um provedor de IA em Conexões.',
    );
  }

  /** Gera a resposta do agente em streaming (chunks de texto). */
  async *chatStream(input: ChatInput): AsyncGenerator<string> {
    const system = await this.comDiretrizes(
      input.empresaId,
      await this.buildSystem(input),
    );
    const creds = await this.resolveCreds(input.empresaId);

    const messages = input.messages.filter((m) => m.text && m.text.trim());
    if (messages.length === 0) {
      throw new BadRequestException('Envie ao menos uma mensagem.');
    }

    yield* getProvider(creds.provider).streamChat({
      apiKey: creds.apiKey,
      model: creds.model,
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
  }

  /**
   * Resposta única (não-streaming) usada por relatórios longos — ex.: a Análise
   * de conteúdo. Resolve as credenciais do tenant e chama o provedor com um
   * limite de tokens maior que o chat.
   */
  /**
   * Traduz erros do provedor de IA (SDK Anthropic/OpenAI) em mensagens claras
   * para o usuário. Sem isto, uma chave inválida ou modelo indisponível vira um
   * 500 opaco ("Erro na busca") sem pista do que corrigir.
   */
  private traduzErroProvedor(err: unknown): never {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : undefined;
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
    const creds = await this.resolveCreds(empresaId);
    const systemFinal = opts.semDiretrizes
      ? system
      : await this.comDiretrizes(empresaId, system);
    const result = await getProvider(creds.provider)
      .complete({
        apiKey: creds.apiKey,
        model: creds.model,
        system: systemFinal,
        user,
        maxTokens,
      })
      .catch((err) => this.traduzErroProvedor(err));
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
    const creds = await this.resolveCreds(empresaId);
    const provider = getProvider(creds.provider);
    const params = {
      apiKey: creds.apiKey,
      model: creds.model,
      system: await this.comDiretrizes(empresaId, system),
      user,
      maxTokens,
    };
    const result = await (provider.completeWeb
      ? provider.completeWeb(params)
      : provider.complete(params).then(
          (r): LlmWebResult => ({
            text: r.text,
            fontes: [],
            truncated: r.truncated,
            usage: r.usage,
          }),
        )
    ).catch((err) => this.traduzErroProvedor(err));
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
