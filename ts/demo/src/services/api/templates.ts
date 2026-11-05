import axios from "@/utils/axios";

/**
 * Cliente da API de Templates de apresentação (backend ts/api, módulo
 * `templates`). Configurações › Geral › Aparência › Templates.
 *
 * Um template é uma apresentação de referência (.pptx, .html ou .zip com HTML
 * e recursos) que orienta a ESTRUTURA dos slides gerados pelo AI Studio. A
 * aparência continua vindo da identidade visual (Marca).
 *
 * Leitura liberada à organização; escrita exige `configuracoes.gerenciar`
 * (a API responde 403 com a mensagem pronta para exibir).
 */

// ---- Estrutura extraída (cópia do contrato em ts/api/src/templates/processar/tipos.ts)

export type TipoElementoTemplate =
  | "titulo"
  | "subtitulo"
  | "texto"
  | "imagem"
  | "grafico"
  | "tabela"
  | "forma";

export interface ElementoTemplate {
  tipo: TipoElementoTemplate;
  /** Frações (0–1) da largura/altura do slide. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ArquetipoSlide =
  | "capa"
  | "secao"
  | "conteudo"
  | "comparacao"
  | "imagem-texto"
  | "grade-cards"
  | "indicadores"
  | "grafico"
  | "tabela"
  | "citacao"
  | "encerramento";

export interface SlideTemplate {
  indice: number;
  arquetipo: ArquetipoSlide;
  elementos: ElementoTemplate[];
}

export interface LayoutRecorrente {
  arquetipo: ArquetipoSlide;
  ocorrencias: number;
  slides: number[];
}

export interface TemplateEstrutura {
  versaoFormato: 1;
  origem: "pptx" | "html";
  largura: number;
  altura: number;
  proporcao: string;
  totalSlides: number;
  slides: SlideTemplate[];
  layoutsRecorrentes: LayoutRecorrente[];
  geometriaAproximada: boolean;
  avisos: string[];
}

// ---- Registro

export type FormatoTemplate = "pptx" | "html";

export interface TemplatePrevia {
  proporcao: string;
  totalSlides: number;
  primeiro: SlideTemplate | null;
  layoutsRecorrentes: LayoutRecorrente[];
  geometriaAproximada: boolean;
}

/** Como a listagem devolve: sem o arquivo e sem a estrutura completa. */
export interface TemplateApresentacao {
  id: string;
  nome: string;
  descricao: string | null;
  contexto: string | null;
  formato: FormatoTemplate;
  arquivoNome: string;
  arquivoTamanho: number;
  ativo: boolean;
  /** Sobe a cada troca de arquivo. */
  versao: number;
  previa: TemplatePrevia;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export interface TemplateCompleto extends TemplateApresentacao {
  estrutura: TemplateEstrutura;
}

/** Resultado da análise de um arquivo ainda não salvo. */
export interface AnaliseTemplate {
  formato: FormatoTemplate;
  estrutura: TemplateEstrutura;
}

export interface MetadadosTemplate {
  nome: string;
  descricao?: string;
  contexto?: string;
}

/** Extensões aceitas pelo upload (o servidor revalida conteúdo e assinatura). */
export const TEMPLATE_ACCEPT = ".pptx,.html,.htm,.zip";
/** Mesmo teto do servidor (corpo de requisição da função serverless). */
export const LIMITE_TEMPLATE_BYTES = 4 * 1024 * 1024;

type Progresso = (fracao: number) => void;

const comProgresso = (onProgresso?: Progresso) =>
  onProgresso
    ? {
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (e.total) onProgresso(Math.min(1, e.loaded / e.total));
        },
      }
    : {};

/** GET /empresa/templates[?ativos=1] */
export async function fetchTemplatesApi(
  opcoes: { soAtivos?: boolean } = {},
): Promise<TemplateApresentacao[]> {
  const { data } = await axios.get<TemplateApresentacao[]>("/empresa/templates", {
    params: opcoes.soAtivos ? { ativos: 1 } : undefined,
  });
  return data;
}

/** GET /empresa/templates/:id → com a estrutura completa. */
export async function fetchTemplateApi(id: string): Promise<TemplateCompleto> {
  const { data } = await axios.get<TemplateCompleto>(
    `/empresa/templates/${encodeURIComponent(id)}`,
  );
  return data;
}

/**
 * POST /empresa/templates/analisar → processa o arquivo SEM salvar. É o que
 * alimenta o status e a prévia do formulário antes do "Salvar".
 */
export async function analisarTemplateApi(
  arquivo: File,
  onProgresso?: Progresso,
): Promise<AnaliseTemplate> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const { data } = await axios.post<AnaliseTemplate>(
    "/empresa/templates/analisar",
    fd,
    comProgresso(onProgresso),
  );
  return data;
}

/** POST /empresa/templates (multipart). 422 se o arquivo não puder ser processado. */
export async function criarTemplateApi(
  meta: MetadadosTemplate,
  arquivo: File,
): Promise<TemplateCompleto> {
  const fd = new FormData();
  fd.append("nome", meta.nome);
  if (meta.descricao) fd.append("descricao", meta.descricao);
  if (meta.contexto) fd.append("contexto", meta.contexto);
  fd.append("arquivo", arquivo);
  const { data } = await axios.post<TemplateCompleto>("/empresa/templates", fd);
  return data;
}

/** PATCH /empresa/templates/:id → metadados e/ou ativo. */
export async function atualizarTemplateApi(
  id: string,
  dados: Partial<MetadadosTemplate> & { ativo?: boolean },
): Promise<TemplateCompleto> {
  const { data } = await axios.patch<TemplateCompleto>(
    `/empresa/templates/${encodeURIComponent(id)}`,
    dados,
  );
  return data;
}

/**
 * PUT /empresa/templates/:id/arquivo → troca o arquivo. Em caso de falha o
 * servidor mantém o arquivo e a estrutura anteriores.
 */
export async function trocarArquivoTemplateApi(
  id: string,
  arquivo: File,
): Promise<TemplateCompleto> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const { data } = await axios.put<TemplateCompleto>(
    `/empresa/templates/${encodeURIComponent(id)}/arquivo`,
    fd,
  );
  return data;
}

/** DELETE /empresa/templates/:id */
export async function removerTemplateApi(id: string): Promise<void> {
  await axios.delete(`/empresa/templates/${encodeURIComponent(id)}`);
}

/** GET /empresa/templates/:id/arquivo → o arquivo original, para download. */
export async function baixarArquivoTemplateApi(id: string): Promise<Blob> {
  const { data } = await axios.get<Blob>(
    `/empresa/templates/${encodeURIComponent(id)}/arquivo`,
    { responseType: "blob" },
  );
  return data;
}
