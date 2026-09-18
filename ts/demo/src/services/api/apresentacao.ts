import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar apresentação (IA) — planejar → gerar → consumir, contra o ts/api:
//  1) POST /ai/apresentacao/plano    → o que cada slide vai FAZER (revisável)
//  2) POST /ai/apresentacao/ajustar  → reescreve UM slide do plano por instrução
//  3) POST /ai/apresentacao/slides   → a IA executa o plano (conteúdo final)
//  4) POST /ai/apresentacao/gerar    → .pptx (download) ou HTML — determinístico
//
// `/roteiro` é o caminho anterior (config → texto final direto) e segue vivo.

export type Formato = "pptx" | "slides-html" | "book-html";

/** Layouts que os renderizadores desenham. Espelha `TipoSlide` do backend. */
export type TipoSlide =
  | "capa"
  | "secao"
  | "conteudo"
  | "destaque"
  | "comparacao";

/** Especificação semântica de um slide — o que ele faz, não o texto final. */
export interface PlanoSlide {
  id: string;
  tipo: TipoSlide;
  titulo: string;
  subtitulo?: string;
  objetivo?: string;
  conteudo?: string[];
  narrativa?: string;
  direcaoVisual?: string;
}

export interface Plano {
  titulo: string;
  subtitulo: string;
  slides: PlanoSlide[];
  conexoes: string;
}

export interface SlideItem {
  /** Ausente = "conteudo". */
  tipo?: TipoSlide;
  titulo: string;
  subtitulo?: string;
  bullets?: string[];
  destaques?: { valor: string; rotulo: string }[];
  colunas?: { titulo: string; itens: string[] }[];
  notas?: string;
}
export interface CapituloItem {
  titulo: string;
  paragrafos: string[];
}
export interface Roteiro {
  titulo: string;
  subtitulo: string;
  slides?: SlideItem[];
  capitulos?: CapituloItem[];
  /**
   * Bloco "## 🔗 Conexões no Vault" ([[wikilinks]] para outros assuntos da
   * Memória). Entra na nota ao salvar no Repositório; não vai para o .pptx/.html.
   */
  conexoes: string;
}

/**
 * Proveniência da geração, espelhando `FontesUsadas` do backend.
 *
 * A assimetria é real e importa na hora de escrever a mensagem: o CONTEÚDO das
 * memórias entra no prompt; do vault só saem TÍTULOS, e apenas como alvos de
 * [[wikilink]] no bloco de conexões — nenhum .md é lido na geração.
 */
export interface FontesUsadas {
  /** Regras/definições ativas cujo conteúdo entrou como referência. */
  memorias: { id: string; title: string; category: string }[];
  /** Títulos oferecidos como alvo de [[wikilink]] — não foram lidos. */
  vaultTitulos: string[];
  /** O bloco de referências passou de 20.000 caracteres e foi cortado. */
  truncado: boolean;
}

export interface RoteiroReq {
  tema: string;
  formato: Formato;
  nSlides?: number;
  publico?: string;
  objetivo?: string;
  tom?: string;
  idioma?: string;
  fontes?: string[];
  referencia?: string;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

/**
 * Etapa 1 — gera o roteiro editável.
 *
 * `fontesUsadas` é opcional de propósito: um servidor anterior a este campo
 * continua funcionando, e quem consome apenas omite o bloco de fontes.
 */
export async function gerarRoteiroApi(req: RoteiroReq): Promise<{
  formato: Formato;
  roteiro: Roteiro;
  fontesUsadas?: FontesUsadas;
}> {
  const { data } = await axios.post<{
    formato: Formato;
    roteiro: Roteiro;
    fontesUsadas?: FontesUsadas;
  }>("/ai/apresentacao/roteiro", req);
  return data;
}

/** Etapa 1 — a IA projeta a apresentação (o plano revisável). */
export async function gerarPlanoApi(req: RoteiroReq): Promise<{
  formato: Formato;
  plano: Plano;
  fontesUsadas?: FontesUsadas;
}> {
  const { data } = await axios.post<{
    formato: Formato;
    plano: Plano;
    fontesUsadas?: FontesUsadas;
  }>("/ai/apresentacao/plano", req);
  return data;
}

/**
 * Reescreve UM slide do plano a partir de uma instrução em linguagem natural.
 * Manda o plano inteiro porque a instrução é relativa à progressão ("faça virar
 * transição" depende dos vizinhos), mas só o slide pedido volta alterado.
 */
export async function ajustarSlideApi(req: {
  plano: Plano;
  indice: number;
  instrucao: string;
  design?: DesignSystem;
}): Promise<PlanoSlide> {
  const { data } = await axios.post<{ slide: PlanoSlide }>(
    "/ai/apresentacao/ajustar",
    req,
  );
  return data.slide;
}

/** Etapa 2 — a IA executa o plano aprovado e escreve o conteúdo final. */
export async function gerarSlidesApi(req: {
  plano: Plano;
  formato: Formato;
  publico?: string;
  objetivo?: string;
  tom?: string;
  design?: DesignSystem;
}): Promise<Roteiro> {
  const { data } = await axios.post<{ formato: Formato; roteiro: Roteiro }>(
    "/ai/apresentacao/slides",
    req,
  );
  return data.roteiro;
}

/** Etapa 3 (pptx) — devolve o arquivo .pptx como Blob para download. */
export async function gerarPptxApi(
  roteiro: Roteiro,
  design?: DesignSystem,
): Promise<Blob> {
  const { data } = await axios.post<Blob>(
    "/ai/apresentacao/gerar",
    { formato: "pptx", roteiro, design },
    { responseType: "blob" },
  );
  return data;
}

/** Etapa 2 (HTML) — devolve o HTML autônomo (slides-html ou book-html). */
export async function gerarHtmlApi(
  formato: Formato,
  roteiro: Roteiro,
  design?: DesignSystem,
): Promise<string> {
  const { data } = await axios.post<{ html: string }>(
    "/ai/apresentacao/gerar",
    {
      formato,
      roteiro,
      design,
    },
  );
  return data.html;
}

// ----------------------------------------------------------------------
// Identidade visual a partir de um documento
//
// O manual de marca (PDF ou Word) vira paleta. É o único caminho que muda a cor
// do arquivo gerado: o renderizador lê hexadecimais, não descrições.
// ----------------------------------------------------------------------

export interface IdentidadeExtraida {
  nome: string;
  tom: string;
  cores: {
    primaria: string;
    secundaria: string;
    acento: string;
    fundo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
  };
  fonteTitulo: string;
  fonteCorpo: string;
  /** O que a IA deduziu por falta de informação no documento. */
  observacoes: string;
}

/** Formatos que `extrairTexto` no backend sabe ler. Sem imagem: nenhum provedor
    desta plataforma lê pixels. */
export const IDENTIDADE_ACCEPT = ".pdf,.docx,.txt,.md";

/**
 * POST /ai/apresentacao/identidade → extrai a identidade visual do documento.
 *
 * 400 quando o arquivo não é legível ou não tem nada de identidade — a mensagem
 * do backend já vem pronta para exibir, e o fluxo segue no visual neutro.
 */
export async function extrairIdentidadeApi(
  arquivo: File,
): Promise<{ identidade: IdentidadeExtraida; origem: string }> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const { data } = await axios.post<{
    identidade: IdentidadeExtraida;
    origem: string;
  }>("/ai/apresentacao/identidade", fd);
  return data;
}
