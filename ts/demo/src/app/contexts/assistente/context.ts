// Estado do assistente em bolinha (canto inferior direito). Fica num contexto
// porque a mesma conversa é dirigida por DUAS entradas — a barra de prompt do
// header e o input do próprio painel — e o painel vive fora do header.
import { createSafeContext } from "@/utils/createSafeContext";
import type {
  AgenteDaResposta,
  ArquivoConversa,
  Fonte,
  MencaoAgente,
  ModoBusca,
} from "@/services/api/prompt";
import type {
  AprovacaoOrquestrador,
  EtapaOrquestrador,
  ExecucaoAberta,
} from "@/services/api/orquestrador";

// ----------------------------------------------------------------------

/**
 * Um par pergunta/resposta da conversa. `pendente` = resposta a caminho.
 *
 * Com vários agentes @mencionados, cada agente gera o SEU turno: o primeiro
 * leva a pergunta; os seguintes são `continuacao` (mesma pergunta, outra
 * resposta) e não a repetem na tela.
 */
export interface Turno {
  pergunta: string;
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
  pendente?: boolean;
  /**
   * Agente que produziu ESTA resposta (null = Assistente padrão). Fica no
   * turno — é a identidade da resposta, e continua certa depois de o agente
   * ser editado ou excluído.
   */
  agente?: AgenteDaResposta | null;
  /** Arquivos gerados nesta resposta — pertencem à conversa. */
  arquivos?: ArquivoConversa[];
  /** Id da mensagem da resposta (para marcar um arquivo como salvo). */
  mensagemId?: string;
  /** Agentes @mencionados na pergunta (só no turno que leva a pergunta). */
  mencoes?: MencaoAgente[];
  /** Resposta de mais um agente à pergunta do turno anterior. */
  continuacao?: boolean;
  /**
   * O orquestrador resolveu este turno em etapas. Durante a resposta as
   * etapas chegam ao vivo; ao reabrir a conversa só há o `id`, e as etapas
   * são buscadas quando o usuário pede para vê-las.
   */
  execucao?: ExecucaoDoTurno;
}

export interface ExecucaoDoTurno {
  /** Id da execução (chega com a resposta, ou vem do `meta` ao reabrir). */
  id?: string;
  etapas: EtapaOrquestrador[];
  /** Ações de escrita esperando o usuário aprovar ou negar. */
  aprovacoes?: AprovacaoDoTurno[];
}

export interface AprovacaoDoTurno extends AprovacaoOrquestrador {
  /** true enquanto a decisão está sendo enviada (botões travados). */
  enviando?: boolean;
}

/** "minimized" mantém a conversa em memória, só recolhe o painel na bolinha. */
export type AssistenteStatus = "closed" | "open" | "minimized";

export type AssistenteTab = "chat" | "historico";

/** Resultado de `perguntar` — a barra desenha a própria linha de status com ele. */
export type PerguntarResult =
  | { ok: true; origem: "vault" | "web"; /** Texto da 1ª resposta (para a resposta falada). */ resposta?: string }
  | { ok: false; erro: string };

export interface AssistenteContextValue {
  status: AssistenteStatus;
  tab: AssistenteTab;
  conversa: Turno[];
  conversaId: string | null;
  modoConversa: ModoBusca;
  loading: boolean;
  /** Resposta chegou com o painel fechado/minimizado → badge na bolinha. */
  naoLido: boolean;

  /** Painel ampliado (janela central) em vez de ancorado no canto. */
  expandido: boolean;

  /**
   * Rascunho do campo de envio do painel. Vive aqui (e não no painel) para que
   * outras telas possam inserir uma @menção nele — ver `inserirMencao`.
   */
  rascunho: string;
  setRascunho: (v: string) => void;
  /** Muda a cada pedido de foco no campo (o painel foca e põe o cursor no fim). */
  pedidoDeFoco: number;
  /**
   * Chama um agente para a próxima mensagem: abre o painel na aba Chat,
   * acrescenta "@Menção " ao rascunho e devolve o foco ao campo. NÃO envia.
   */
  inserirMencao: (agente: { mencao: string }) => void;

  /** Marca um arquivo da conversa como salvo no Repositório. */
  marcarArquivoSalvo: (p: {
    mensagemId: string;
    arquivoId: string;
    repositorioDocumentoId: string;
  }) => Promise<void>;

  setTab: (t: AssistenteTab) => void;
  setExpandido: (v: boolean) => void;
  /** Restaura a conversa atual (ou abre no estado vazio, se não houver). */
  open: () => void;
  minimize: () => void;
  close: () => void;
  /** Limpa a conversa e mantém o painel aberto na aba Chat. */
  novaConversa: () => void;

  /**
   * Pergunta nova: zera a conversa, abre o painel e responde.
   *
   * @menções no texto chamam os agentes (cada um responde em separado, na
   * ordem); sem menção, responde o Assistente padrão.
   *
   * `contexto` é um bloco de texto que acompanha TODOS os turnos desta
   * conversa como referência para a IA, sem aparecer nas bolhas (ex.: o
   * insight de onde a conversa partiu). Nova conversa sem ele o descarta.
   */
  perguntar: (p: {
    texto: string;
    modo: ModoBusca;
    arquivo?: File | null;
    contexto?: string;
    /** Como o pedido chegou (texto, ditado ou palavra de ativação). */
    origem?: "texto" | "voz" | "voz_ativacao";
    /** Outras transcrições do ditado (corrigem nomes de apps). */
    alternativas?: string[];
  }) => Promise<PerguntarResult>;
  /** Follow-up dentro da conversa aberta (também reconhece @menções). */
  continuar: (texto: string) => Promise<void>;
  /**
   * Publica um aviso do próprio app na conversa e abre o painel — sem chamar a
   * IA. Para fluxos que concluem algo em outra tela e querem relatar o
   * resultado aqui (ex.: o roteiro que o AI Studio acabou de gerar).
   *
   * Acrescenta ao fim da conversa em vez de zerá-la: um aviso não deve
   * descartar o que o usuário estava perguntando.
   */
  anunciar: (aviso: { titulo: string; corpo: string }) => void;
  /** Carrega uma conversa persistida do histórico dentro do painel. */
  abrirConversa: (id: string) => Promise<void>;
  /**
   * Aprova ou nega uma ação de escrita pedida pelo orquestrador. Se era a
   * última pendente, a execução continua no mesmo turno até a resposta.
   */
  decidirAprovacao: (p: {
    execucaoId: string;
    aprovacaoId: string;
    aprovar: boolean;
  }) => Promise<void>;
  /**
   * Execuções que ainda pedem algo do usuário: esperando aprovação,
   * interrompidas por uma queda da API ou ainda rodando. Recarregada ao abrir
   * o painel.
   */
  abertas: ExecucaoAberta[];
  /** Mostra a execução no painel; interrompida e retomável, já retoma. */
  abrirExecucao: (e: ExecucaoAberta) => Promise<void>;
  /** Descarta uma execução parada (nada pendente é executado). */
  descartarExecucao: (execucaoId: string) => Promise<void>;
}

export const [AssistenteProvider, useAssistente] =
  createSafeContext<AssistenteContextValue>(
    "useAssistente deve ser usado dentro de <AssistenteHostProvider>",
  );
