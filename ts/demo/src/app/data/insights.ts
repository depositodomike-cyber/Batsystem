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
  /** Criação em ISO (vem do backend; usado no tempo relativo do sino). */
  criadoEm?: string;
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
  /** De onde veio (ex.: "Áudio", "Transcrição", "Documento"). */
  origem?: string;
  /** Direcionamento a que a IA relacionou o insight, quando houver. */
  direcionamento?: { id: string; nome: string };
  /** O "Este insight foi útil?" do próprio usuário. */
  meuFeedback?: InsightFeedback;
  /**
   * Ação que a IA sugere a partir do insight (hoje: marcar uma reunião). Com
   * ela, o modal de detalhe mostra o bloco "Ação sugerida" e o rodapé de
   * agendamento no lugar do feedback.
   */
  acaoSugerida?: AcaoSugeridaReuniao;
}

export interface AcaoSugeridaReuniao {
  tipo: "reuniao";
  titulo: string;
  /** Ex.: "30 min". */
  duracao: string;
  descricao: string;
  /** Áreas que participam da reunião sugerida. */
  areas: string[];
}

// ----------------------------------------------------------------------
// Insight de EXEMPLO do protótipo: um caso com sugestão de reunião. Vive só
// no cliente — entra no topo da lista que vem da API, e os serviços de
// insight o resolvem localmente (sem requisição). Agendar é
// simulado com toast.
// ----------------------------------------------------------------------

const PREFIXO_DEMO = "demo-";

/** True para insights de exemplo do protótipo (não existem no servidor). */
export function ehInsightDemo(id: string): boolean {
  return id.startsWith(PREFIXO_DEMO);
}

export const INSIGHT_EXEMPLO_REUNIAO: Insight = {
  id: `${PREFIXO_DEMO}reuniao-regras`,
  titulo: "Divergência recorrente na aplicação das regras",
  descricao:
    "Foram identificadas interpretações diferentes sobre a aplicação das regras de proteção de informações financeiras entre as áreas envolvidas. Essa divergência pode gerar decisões inconsistentes e aumentar o risco de falhas no processo.",
  data: "23/09/2026",
  criadoEm: "2026-09-23T12:00:00.000Z",
  tipo: "Processo",
  cor: "secondary",
  acaoSugerida: {
    tipo: "reuniao",
    titulo: "Reunião de alinhamento",
    duracao: "30 min",
    descricao:
      "Revisar as regras atuais, esclarecer as divergências identificadas e definir os próximos passos.",
    areas: ["Compliance", "Segurança da Informação", "Produto"],
  },
};

/**
 * Detalhe do insight (modal "Ver insight"). A listagem não traz estes campos —
 * o modal os busca sob demanda. Tudo opcional: insights antigos não têm
 * análise nem evidências, e o modal só mostra a seção que existir.
 */
export interface InsightDetalhe extends Insight {
  analise?: string;
  /** Trechos literais do material de origem. */
  evidencias: string[];
  /** Material de origem (Memória), se ainda existir. */
  fonte?: { titulo: string; categoria: string; data: string };
}

// ----------------------------------------------------------------------
// Feedback ("Este insight foi útil?").
// ----------------------------------------------------------------------

export type InsightFeedbackMotivo =
  | "nao_relevante"
  | "ja_conhecia"
  | "conclusao_incorreta"
  | "nao_quero_assunto"
  | "outro";

export interface InsightFeedback {
  util: boolean;
  motivo?: InsightFeedbackMotivo;
}

export const MOTIVOS_FEEDBACK: { value: InsightFeedbackMotivo; label: string }[] =
  [
    { value: "nao_relevante", label: "Não é relevante" },
    { value: "ja_conhecia", label: "Já conheço essa informação" },
    { value: "conclusao_incorreta", label: "A conclusão não parece correta" },
    {
      value: "nao_quero_assunto",
      label: "Não quero receber insights sobre este assunto",
    },
    { value: "outro", label: "Outro" },
  ];

// ----------------------------------------------------------------------
// Direcionador de insights — orientações da organização para a IA sobre o
// que observar e como tratar os insights. Guiam foco e critério, nunca a
// conclusão.
// ----------------------------------------------------------------------

export type DirecionamentoTipo = "priorizar_assunto" | "ajustar_insights";
export type DirecionamentoPrioridade = "normal" | "alta";

export interface InsightDirecionamento {
  id: string;
  nome: string;
  tipo: DirecionamentoTipo;
  instrucao: string;
  /** Nulo = toda a organização. */
  area: { id: string; nome: string } | null;
  prioridade: DirecionamentoPrioridade;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/** Campos editáveis — o que o modal de criar/editar envia. */
export interface DirecionamentoInput {
  nome: string;
  tipo: DirecionamentoTipo;
  instrucao: string;
  areaId: string | null;
  prioridade: DirecionamentoPrioridade;
}

export const DIRECIONAMENTO_TIPOS: {
  value: DirecionamentoTipo;
  titulo: string;
  /** Rótulo curto para a listagem. */
  rotulo: string;
  descricao: string;
  labelInstrucao: string;
  placeholderInstrucao: string;
}[] = [
  {
    value: "priorizar_assunto",
    titulo: "Priorizar um assunto",
    rotulo: "Priorizar assunto",
    descricao: "Quero receber mais insights sobre determinado tema.",
    labelInstrucao: "O que você quer que a IA observe?",
    placeholderInstrucao:
      "Ex.: Identifique mudanças, padrões ou sinais que possam indicar aumento de turnover e possíveis fatores relacionados.",
  },
  {
    value: "ajustar_insights",
    titulo: "Ajustar os insights",
    rotulo: "Ajustar insights",
    descricao: "Quero orientar a IA sobre insights que não estão sendo úteis.",
    labelInstrucao: "Como você quer ajustar os insights?",
    placeholderInstrucao:
      "Ex.: Evite considerar pequenas oscilações semanais como tendências relevantes.",
  },
];

export const PRIORIDADE_ROTULO: Record<DirecionamentoPrioridade, string> = {
  normal: "Normal",
  alta: "Alta",
};

export const DIRECIONAMENTO_MAX_NOME = 120;
export const DIRECIONAMENTO_MAX_INSTRUCAO = 2000;

/**
 * Sugestão de direcionamento a partir de um 👎. Só PRÉ-PREENCHE o modal — o
 * usuário revisa e decide se salva; nada é criado sozinho.
 */
export function sugerirDirecionamento(
  insight: Pick<Insight, "titulo" | "tipo">,
  motivo: InsightFeedbackMotivo,
): Partial<DirecionamentoInput> {
  const tema = insight.tipo || "este tema";
  switch (motivo) {
    case "nao_relevante":
      return {
        nome: `Menos insights como: ${tema}`,
        tipo: "ajustar_insights",
        instrucao: `Evite gerar insights como “${insight.titulo}” quando não houver evidência de uma tendência relevante.`,
      };
    case "ja_conhecia":
      return {
        nome: `Evitar o óbvio em ${tema}`,
        tipo: "ajustar_insights",
        instrucao: `Em ${tema}, evite destacar informações já conhecidas, como “${insight.titulo}”. Priorize mudanças e padrões novos.`,
      };
    case "conclusao_incorreta":
      return {
        nome: `Mais cuidado nas conclusões sobre ${tema}`,
        tipo: "ajustar_insights",
        instrucao: `Ao analisar ${tema}, só apresente uma conclusão quando houver evidência suficiente. Sem ela, descreva o sinal como possível relação que pode merecer investigação.`,
      };
    case "nao_quero_assunto":
      return {
        nome: `Não priorizar ${tema}`,
        tipo: "ajustar_insights",
        instrucao: `Não gere insights sobre ${tema}, a menos que haja um sinal claramente crítico.`,
      };
    default:
      return { tipo: "ajustar_insights" };
  }
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

// Ações OCULTAS temporariamente no menu do card. Hoje nenhuma: as seis voltaram
// a aparecer, abaixo de "Conversar com o assistente". Para ocultar uma de
// novo, basta incluí-la nesta lista — o fluxo (seletor de pessoa, formulário
// de reunião) continua no código.
export const INSIGHT_ACOES_OCULTAS: readonly InsightAcao[] = [];

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
