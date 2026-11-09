// ----------------------------------------------------------------------
// Resumo Matinal — contrato do briefing (espelhado em
// ts/demo/src/services/api/briefing.ts). Fatos (horário, remetente, link,
// fonte, data) vêm sempre das fontes; da IA vêm só seleção, nível e texto.
// ----------------------------------------------------------------------

export type Periodo = 'manha' | 'noite';
export type Nivel = 'atencao' | 'importante' | 'informativo' | 'oportunidade';
export const NIVEIS: readonly Nivel[] = ['atencao', 'importante', 'informativo', 'oportunidade'];

export type FonteId = 'agenda' | 'email' | 'clima' | 'noticias' | 'repositorio' | 'operacoes' | 'perfil' | 'ia';
export type FonteStatus = 'ok' | 'desconectado' | 'erro' | 'sem-config';

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
  dia: 'hoje' | 'amanha';
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
  tipo: 'projeto' | 'objetivo' | 'tarefa';
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
  tipo: 'oportunidade' | 'atencao' | 'recomendacao';
  titulo: string;
  texto: string;
  /** Itens do briefing/documentos de onde o insight saiu. */
  origens: { ref: string; rotulo: string }[];
}

export interface SegmentoRoteiro {
  secao: 'abertura' | 'clima' | 'agenda' | 'comunicacoes' | 'projetos' | 'noticias' | 'insights' | 'encerramento';
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
  idioma: 'pt' | 'en';
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
  /** Hash da configuração (conectores, IA, Perfil) quando foi gerado. */
  config?: string;
}

/** O que o navegador manda sobre tarefas e projetos (vivem no localStorage). */
export interface OperacoesCliente {
  tarefas?: { id: string; titulo: string; status?: string; prioridade?: string; prazo?: string; projeto?: string }[];
  projetos?: { id: string; nome: string; descricao?: string }[];
}
