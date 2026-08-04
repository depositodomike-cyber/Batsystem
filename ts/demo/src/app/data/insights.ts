// Dados de Insights do produto Business Partner (IA).
// Cada produto tem a sua própria página de Insights — esta é a do BP.
// Duas dimensões: "Para você" (insights pessoais do líder) e
// "Para equipe" (insights por liderado / time inteiro).

// Cor/severidade do insight — reaproveitada do protótipo (engajaí):
// secondary = Ação necessária · warning = Atenção · success = Sucesso ·
// light = Para refletir.
export type InsightCor = "secondary" | "warning" | "success" | "light";

export interface PersonalInsight {
  /** Id do registro no backend (cuid). */
  id: string;
  titulo: string;
  descricao: string;
  /** Data no formato DD/MM/YYYY. */
  data: string;
  tipo: string;
  cor: InsightCor;
}

export type TeamMember =
  | "Ana Silva"
  | "Bruno Santos"
  | "Carla Lima"
  | "Daniel Costa"
  | "Elena Oliveira";

/** A quem o insight se refere — um liderado específico ou o time inteiro. */
export type TeamTarget = TeamMember | "Todos";

/**
 * Insight exibido na lista única. `liderado` é opcional: quando presente,
 * indica a pessoa (ou o time inteiro, "Todos") a que o insight se refere;
 * quando ausente, é um insight geral do líder.
 */
export interface Insight extends PersonalInsight {
  liderado?: TeamTarget;
}

// Rostos reutilizados do acervo do Feed (public/images/feed/faces).
const face = (n: number) => `/images/feed/faces/${n}.jpg`;

export const TEAM_FACES: Record<TeamMember, string> = {
  "Ana Silva": face(1),
  "Bruno Santos": face(12),
  "Carla Lima": face(3),
  "Daniel Costa": face(18),
  "Elena Oliveira": face(9),
};

// ----------------------------------------------------------------------
// Os insights são gerados pela IA a partir do material das áreas (hoje, a
// partir de cada ata/resumo de reunião) e persistidos no backend por empresa.
// A página de Insights os carrega via services/api/insights.ts — não há mais
// lista estática aqui.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Opções de filtro / ordenação.
// ----------------------------------------------------------------------

export type FiltroInsight = InsightCor | "todos" | "visiveis" | "ocultados";

export const FILTRO_OPCOES: { value: FiltroInsight; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "visiveis", label: "Visíveis" },
  { value: "secondary", label: "Ação necessária" },
  { value: "warning", label: "Atenção" },
  { value: "success", label: "Sucesso" },
  { value: "light", label: "Para refletir" },
  { value: "ocultados", label: "Ocultados" },
];

export type OrdenacaoInsight = "alfabetica" | "data-recente" | "data-antiga";

export const ORDENACAO_OPCOES: { value: OrdenacaoInsight; label: string }[] = [
  { value: "alfabetica", label: "Ordem alfabética" },
  { value: "data-recente", label: "Mais recentes primeiro" },
  { value: "data-antiga", label: "Mais antigos primeiro" },
];

// Ações do menu de cada card de insight (placeholders por enquanto).
export const INSIGHT_ACOES = [
  "Criar Tarefa",
  "Agendar Reunião",
  "Enviar via Chat",
  "Adicionar pauta para 1:1",
  "Upload Documento",
  "Fazer Elogio",
] as const;

export type InsightAcao = (typeof INSIGHT_ACOES)[number];

// Ações que exigem escolher uma pessoa antes de prosseguir. "Upload Documento"
// é a única exceção (não abre a lista de usuários).
export const ACOES_SEM_PESSOA: InsightAcao[] = ["Upload Documento"];

// ----------------------------------------------------------------------
// Pessoas da empresa — usadas no seletor que abre ao acionar uma ação do card
// (foto + nome completo).
// ----------------------------------------------------------------------

export interface InsightUser {
  id: string;
  nome: string;
  cargo: string;
  face: string;
}

// Conector de e-mail/agenda ao qual o usuário está conectado — usado no
// formulário "Agendar Reunião". Reflete o Google Calendar (conectado por
// padrão na área de Conectores), responsável por criar eventos na agenda.
export interface EmailConnector {
  id: string;
  nome: string;
  conta: string;
  brand: string;
  initials: string;
}

export const MEETING_EMAIL_CONNECTOR: EmailConnector = {
  id: "google-calendar",
  nome: "Google Calendar",
  conta: "voce@greghub.com",
  brand: "#1a73e8",
  initials: "GC",
};

export const INSIGHT_USUARIOS: InsightUser[] = [
  { id: "ana-silva", nome: "Ana Silva", cargo: "Analista de Produto", face: face(1) },
  { id: "bruno-santos", nome: "Bruno Santos", cargo: "Desenvolvedor Backend", face: face(12) },
  { id: "carla-lima", nome: "Carla Lima", cargo: "Designer de Produto", face: face(3) },
  { id: "daniel-costa", nome: "Daniel Costa", cargo: "Especialista de Dados", face: face(18) },
  { id: "elena-oliveira", nome: "Elena Oliveira", cargo: "Gerente de Projetos", face: face(9) },
  { id: "fernanda-azevedo", nome: "Fernanda Azevedo", cargo: "Diretora de Estratégia", face: face(5) },
  { id: "rafael-monteiro", nome: "Rafael Monteiro", cargo: "Head de People", face: face(7) },
  { id: "juliana-farias", nome: "Juliana Farias", cargo: "Líder de Bem-estar", face: face(16) },
  { id: "lucas-ferreira", nome: "Lucas Ferreira", cargo: "Líder de Transformação Digital", face: face(6) },
  { id: "mariana-lopes", nome: "Mariana Lopes", cargo: "Head de Liderança & Cultura", face: face(11) },
  { id: "andre-martins", nome: "André Martins", cargo: "Coordenador de Aprendizagem", face: face(14) },
  { id: "camila-rocha", nome: "Camila Rocha", cargo: "Head de Governança", face: face(20) },
];

/** Converte "DD/MM/YYYY" em valor numérico AAAAMMDD para ordenação. */
export function dataParaNumero(str: string): number {
  const [d, m, y] = str.split("/").map(Number);
  return y * 10000 + m * 100 + d;
}
