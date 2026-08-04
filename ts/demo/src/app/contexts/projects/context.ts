import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
}

/**
 * E-mail guardado dentro de um grupo (salvo pela página de E-mail). Guardamos
 * uma cópia do conteúdo, não só o id: a caixa de entrada é uma fonte externa e
 * o grupo precisa continuar legível mesmo que o e-mail saia de lá.
 */
export interface ProjectEmail {
  /** Id do e-mail na caixa de entrada — usado para evitar duplicatas. */
  id: string;
  assunto: string;
  remetente: string;
  /** ISO 8601, copiado do e-mail original. */
  data: string;
  corpo: string;
  /** Quando foi salvo no grupo (epoch ms). */
  salvoEm: number;
}

/**
 * Mensagem ou thread do Slack guardada dentro de um grupo (salva pela página de
 * Slack). Mesma decisão do e-mail: guardamos uma cópia do texto, não o id.
 */
export interface ProjectSlackItem {
  /** Id da mensagem no Slack (com sufixo "#thread" quando é a thread inteira). */
  id: string;
  /** Onde a conversa aconteceu: "#produto", "Juliana Prado"… */
  origem: string;
  /** O que foi salvo. */
  tipo: "mensagem" | "thread";
  autor: string;
  /** ISO 8601, copiado da mensagem original. */
  data: string;
  /** Texto da mensagem — na thread, inclui as respostas. */
  texto: string;
  /** Quando foi salvo no grupo (epoch ms). */
  salvoEm: number;
}

export interface Project {
  id: string;
  /** Produto ao qual o agrupamento pertence (ex.: "business-partner"). */
  product: string;
  title: string;
  instructions: string;
  /** Fontes: conectores corporativos selecionados. */
  connectorCodes: string[];
  /** Fontes: links adicionados. */
  links: string[];
  /** Fontes: arquivos anexados. */
  files: ProjectFile[];
  /** Itens da memória executiva vinculados ao projeto. */
  memoryIds: string[];
  /** E-mails salvos no grupo pela página de E-mail. */
  emails: ProjectEmail[];
  /** Mensagens e threads salvas no grupo pela página de Slack. */
  slack: ProjectSlackItem[];
}

/** O grupo nasce vazio — conteúdo de conector entra depois, pelas páginas deles. */
export type NewProject = Omit<Project, "id" | "emails" | "slack">;

export interface ProjectsContextValue {
  /** Todos os projetos criados (de todos os produtos). */
  projects: Project[];
  /** Projetos de um produto específico. */
  projectsByProduct: (product: string) => Project[];
  addProject: (data: NewProject) => Project;
  removeProject: (id: string) => void;
  /** Renomeia o título de um agrupamento. */
  renameProject: (id: string, title: string) => void;
  getProject: (id: string) => Project | undefined;
  /**
   * Salva um e-mail no grupo. Devolve `false` quando nada foi gravado — grupo
   * inexistente ou e-mail já salvo lá —, para a tela não anunciar sucesso à toa.
   */
  addEmailToProject: (
    projectId: string,
    email: Omit<ProjectEmail, "salvoEm">,
  ) => boolean;
  /** Remove um e-mail salvo no grupo. */
  removeEmailFromProject: (projectId: string, emailId: string) => void;
  /** Salva uma mensagem/thread do Slack no grupo (ignora se já estiver lá). */
  addSlackToProject: (
    projectId: string,
    item: Omit<ProjectSlackItem, "salvoEm">,
  ) => void;
  /** Remove uma mensagem/thread do Slack salva no grupo. */
  removeSlackFromProject: (projectId: string, itemId: string) => void;
  // Estado do modal de criação.
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
}

export const [ProjectsContext, useProjectsContext] =
  createSafeContext<ProjectsContextValue>(
    "useProjectsContext must be used within ProjectsProvider",
  );
