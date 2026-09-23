import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar planilha (IA) — planejar → revisar → gerar, contra o ts/api:
//  1) POST /ai/planilha/fonte    → texto de um arquivo anexado (multipart)
//  2) POST /ai/planilha/plano    → o que cada ABA vai fazer (revisável)
//  3) POST /ai/planilha/ajustar  → reescreve UMA aba do plano por instrução
//  4) POST /ai/planilha/conteudo → as linhas que a IA escreve do plano
//  5) POST /ai/planilha/gerar    → .xlsx (download binário, determinístico)
//
// Espelha `services/api/apresentacao.ts` de propósito: é o mesmo fluxo, com
// abas no lugar de slides.

/** O que o gerador de arquivo sabe formatar. Espelha `TipoColuna` do backend. */
export type TipoColuna =
  | "texto"
  | "numero"
  | "moeda"
  | "percentual"
  | "data"
  | "lista";

/** Papel de uma aba: base de lançamentos, consolidação ou listas auxiliares. */
export type TipoAba = "dados" | "resumo" | "apoio";

export interface PlanoColuna {
  nome: string;
  tipo: TipoColuna;
  descricao?: string;
  /** Coluna calculada: a lógica dela, em português. */
  formula?: string;
  validacao?: string;
}

/**
 * Um cálculo ou indicador.
 *
 * `logica` é o que o usuário revisa; `formula` só aparece em "Ver detalhes".
 * A ordem dos campos aqui é a ordem em que a tela os mostra — lógica de
 * negócio antes de fórmula de planilha.
 */
export interface PlanoCalculo {
  nome: string;
  logica: string;
  formula?: string;
}

export interface PlanoAba {
  id: string;
  tipo: TipoAba;
  nome: string;
  objetivo: string;
  colunas: PlanoColuna[];
  calculos: PlanoCalculo[];
  indicadores: PlanoCalculo[];
  validacoes: string[];
  filtros: boolean;
  /** Nomes de outras abas de que esta depende. */
  dependencias: string[];
  /** Quais fontes alimentam esta aba. */
  fontes: string[];
  /** Traz linhas demonstrativas, que o arquivo vai rotular como exemplo. */
  dadosExemplo: boolean;
}

export interface PlanoPlanilha {
  titulo: string;
  objetivo: string;
  abas: PlanoAba[];
  /** O que as fontes não cobriram, dito em português. */
  limitacoes: string[];
}

/** Proveniência do plano — espelha `FontesPlanilha` do backend. */
export interface FontesPlanilha {
  memorias: { id: string; title: string; category: string }[];
  /**
   * As notas do Repositório que a busca AUTOMÁTICA achou e usou. A tela nunca
   * as escolhe; ela só relata quantas foram.
   */
  notas: { path: string; titulo: string }[];
  truncado: boolean;
}

export interface RecursosPlanilha {
  formulas: boolean;
  filtros: boolean;
  validacoes: boolean;
  formatacaoCondicional: boolean;
}

export interface PlanoPlanilhaParams {
  necessidade: string;
  nome?: string;
  /** "" = a IA decide. */
  detalhamento?: "" | "resumido" | "detalhado";
  /** 0 = a IA decide. */
  nAbas?: number;
  recursos?: RecursosPlanilha;
  /** Texto dos anexos, já extraído por `enviarFonteApi`. */
  referencia?: string;
  design?: DesignSystem;
}

/** POST /ai/planilha/plano → a IA projeta a planilha. */
export async function gerarPlanoPlanilhaApi(
  params: PlanoPlanilhaParams,
): Promise<{ plano: PlanoPlanilha; fontes: FontesPlanilha }> {
  const { data } = await axios.post<{
    plano: PlanoPlanilha;
    fontes: FontesPlanilha;
  }>("/ai/planilha/plano", params);
  return data;
}

/**
 * POST /ai/planilha/ajustar → reescreve UMA aba.
 *
 * `impactos` são as outras abas que o ajuste afeta, declaradas pela IA e NÃO
 * aplicadas: mudar as outras é decisão do usuário.
 */
export async function ajustarAbaApi(params: {
  plano: PlanoPlanilha;
  indice: number;
  instrucao: string;
  design?: DesignSystem;
}): Promise<{ aba: PlanoAba; impactos: string[] }> {
  const { data } = await axios.post<{ aba: PlanoAba; impactos: string[] }>(
    "/ai/planilha/ajustar",
    params,
  );
  return data;
}

/** Formatos que `extrairTexto` no backend sabe ler. */
export const FONTE_ACCEPT = ".csv,.pdf,.docx,.txt,.md";

/**
 * POST /ai/planilha/fonte → texto de um arquivo anexado.
 *
 * Só extrai; não chama IA. A tela guarda o texto e o devolve em `referencia` na
 * hora de planejar — é o que mantém o anexo visível como chip enquanto o
 * usuário mexe no resto da configuração.
 */
export async function enviarFonteApi(
  arquivo: File,
): Promise<{ texto: string; origem: string; caracteres: number }> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const { data } = await axios.post<{
    texto: string;
    origem: string;
    caracteres: number;
  }>("/ai/planilha/fonte", fd);
  return data;
}

/**
 * POST /ai/planilha/gerar → o plano aprovado vira arquivo.
 *
 * Devolve o .xlsx como Blob; nada é baixado aqui. Quem decide baixar (ou
 * salvar no Repositório) é o usuário, na tela — igual à apresentação.
 *
 * Sem `conteudo`, manda as MESMAS fontes de `gerarPlanoPlanilhaApi` e a IA
 * preenche as linhas no servidor. Com `conteudo`, é só construção.
 */
export async function gerarPlanilhaApi(params: {
  plano: PlanoPlanilha;
  /**
   * As linhas já escritas pela IA. Vindo preenchido, a geração é só
   * construção — nenhuma chamada ao modelo. É o que permite baixar de novo
   * uma criação salva, com o arquivo idêntico e sem custo.
   */
  conteudo?: ConteudoPlanilha;
  recursos?: RecursosPlanilha;
  referencia?: string;
  design?: DesignSystem;
}): Promise<Blob> {
  const { data } = await axios.post<Blob>("/ai/planilha/gerar", params, {
    responseType: "blob",
  });
  return data;
}

// ----------------------------------------------------------------------
// Conteúdo — as linhas que a IA escreve a partir do plano aprovado
//
// Vem separado da geração do arquivo porque precisa VOLTAR para o cliente: é
// ele que a criação guarda, e é com ele que o .xlsx é remontado depois sem
// gastar IA de novo.
// ----------------------------------------------------------------------

/** De onde saíram as linhas de uma aba. */
export type OrigemDados = "fontes" | "exemplo" | "vazia";

/** Uma célula: texto, número, ou nada. */
export type Celula = string | number | null;

export interface ConteudoAba {
  /** Casa com `PlanoAba.id`. */
  id: string;
  origem: OrigemDados;
  /** Uma linha por registro, na ordem das colunas do plano. */
  linhas: Celula[][];
}

export interface ConteudoPlanilha {
  abas: ConteudoAba[];
}

/** POST /ai/planilha/conteudo → a IA preenche as linhas. */
export async function gerarConteudoApi(params: {
  plano: PlanoPlanilha;
  referencia?: string;
}): Promise<ConteudoPlanilha> {
  const { data } = await axios.post<{ conteudo: ConteudoPlanilha }>(
    "/ai/planilha/conteudo",
    params,
  );
  return data.conteudo;
}
