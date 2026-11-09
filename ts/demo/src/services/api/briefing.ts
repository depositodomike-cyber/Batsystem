import axios from "@/utils/axios";

// Resumo Matinal — chama /briefing no ts/api.
// Espelho de ts/api/src/briefing/briefing.tipos.ts — mudou lá, mude aqui.

export type Periodo = "manha" | "noite";
export type Nivel = "atencao" | "importante" | "informativo" | "oportunidade";
export const NIVEIS: readonly Nivel[] = ["atencao", "importante", "informativo", "oportunidade"];

export type FonteId = "agenda" | "email" | "clima" | "noticias" | "repositorio" | "operacoes" | "perfil" | "ia";
export type FonteStatus = "ok" | "desconectado" | "erro" | "sem-config";

export interface FonteInfo {
  status: FonteStatus;
  /** ISO de quando o dado foi lido. */
  atualizadoEm?: string;
  mensagem?: string;
}

export interface DocRef {
  path: string;
  titulo: string;
}

export interface Clima {
  cidade: string;
  temperatura: number;
  sensacao?: number;
  condicao: string;
  maxima?: number;
  minima?: number;
  chanceChuva?: number;
  /** Período coberto pela previsão (texto curto, ex.: "hoje, 08/11"). */
  periodo: string;
}

export interface ItemAgenda {
  ref: string;
  evento: {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    diaInteiro: boolean;
    local?: string;
    link?: string;
    reuniaoUrl?: string;
    participantes?: number;
  };
  dia: "hoje" | "amanha";
  /** Já terminou (no resumo noturno: "aconteceu", sem confirmação). */
  passado: boolean;
  conflito: boolean;
  nivel: Nivel;
  nota?: string;
  preparacao?: string;
  docs: DocRef[];
}

export interface ItemComunicacao {
  ref: string;
  email: {
    id: string;
    remetenteNome: string;
    remetenteEmail: string;
    assunto: string;
    data: string;
    link: string;
  };
  nivel: Nivel;
  resumo: string;
  motivo: string;
  exigeAcao: boolean;
}

export interface ItemProjeto {
  ref: string;
  tipo: "projeto" | "objetivo" | "tarefa";
  titulo: string;
  nivel: Nivel;
  situacao: string;
  proximoPasso?: string;
  /** Prazo real (tarefa/objetivo), quando houver. */
  prazo?: string;
  docs: DocRef[];
}

export interface ItemNoticia {
  ref: string;
  titulo: string;
  fonte: string;
  link: string;
  publicadoEm: string;
  resumo: string;
  porQue: string;
  nivel: Nivel;
}

export interface Insight {
  tipo: "oportunidade" | "atencao" | "recomendacao";
  titulo: string;
  texto: string;
  /** Itens do briefing/documentos de onde o insight saiu. */
  origens: { ref: string; rotulo: string }[];
}

export interface SegmentoRoteiro {
  secao: "abertura" | "clima" | "agenda" | "comunicacoes" | "projetos" | "noticias" | "insights" | "encerramento";
  refs: string[];
  texto: string;
}

export interface BriefingDados {
  versao: 1;
  periodo: Periodo;
  data: string;
  fuso: string;
  geradoEm: string;
  nome: string | null;
  idioma: "pt" | "en";
  fontes: Partial<Record<FonteId, FonteInfo>>;
  clima: Clima | null;
  /** Frase-síntese do dia, gerada pela IA (vazia sem IA). */
  sintese: string;
  agenda: ItemAgenda[];
  comunicacoes: ItemComunicacao[];
  projetos: ItemProjeto[];
  noticias: ItemNoticia[];
  insights: Insight[];
  roteiro: SegmentoRoteiro[];
}

/** O que o navegador manda sobre tarefas e projetos (vivem no localStorage). */
export interface OperacoesCliente {
  tarefas?: { id: string; titulo: string; status?: string; prioridade?: string; prazo?: string; projeto?: string }[];
  projetos?: { id: string; nome: string; descricao?: string }[];
}

/** Janela do dia no fuso do navegador (hoje inteiro + amanhã). */
export interface JanelaBriefing {
  data: string;
  periodo: Periodo;
  fuso: string;
  inicio: string;
  fim: string;
}

export function janelaDeHoje(periodo: Periodo, agora = new Date()): JanelaBriefing {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 2);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${inicio.getFullYear()}-${p2(inicio.getMonth() + 1)}-${p2(inicio.getDate())}`,
    periodo,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
  };
}

/** Período sugerido pela hora: a partir das 18h, o resumo noturno. */
export function periodoPelaHora(agora = new Date()): Periodo {
  return agora.getHours() >= 18 ? "noite" : "manha";
}

export async function obterBriefingApi(data: string, periodo: Periodo): Promise<BriefingDados | null> {
  const { data: r } = await axios.get<{ briefing: BriefingDados | null }>("/briefing", {
    params: { data, periodo },
  });
  return r.briefing;
}

export async function gerarBriefingApi(
  janela: JanelaBriefing,
  operacoes: OperacoesCliente,
): Promise<BriefingDados> {
  const { data } = await axios.post<{ briefing: BriefingDados }>("/briefing/gerar", { ...janela, ...operacoes });
  return data.briefing;
}

export async function verificarBriefingApi(
  janela: JanelaBriefing,
): Promise<{ novidades: boolean; existe: boolean }> {
  const { data } = await axios.post<{ novidades: boolean; existe: boolean }>("/briefing/verificar", janela);
  return data;
}
