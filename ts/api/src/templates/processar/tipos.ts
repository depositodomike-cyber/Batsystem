/**
 * Representação interna de um template de apresentação, extraída UMA vez no
 * upload e reutilizada em toda geração (o arquivo bruto nunca é relido).
 *
 * Só ESTRUTURA: caixas, posições, hierarquia e o arquétipo de cada slide.
 * Cores, fontes e o texto do arquivo são deliberadamente descartados — a
 * aparência vem sempre da identidade visual, e o template não é fonte de
 * conteúdo.
 *
 * O frontend tem uma cópia deste contrato em
 * ts/demo/src/services/api/templates.ts.
 */

export type TipoElemento =
  | 'titulo'
  | 'subtitulo'
  | 'texto'
  | 'imagem'
  | 'grafico'
  | 'tabela'
  | 'forma';

/** Caixa de um elemento, em frações (0–1) da largura/altura do slide. */
export interface ElementoTemplate {
  tipo: TipoElemento;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Padrões de composição que o processador sabe reconhecer. Cada um é mapeado
 * para um tipo+variante que os renderizadores sabem desenhar (ver brief.ts).
 */
export const ARQUETIPOS = [
  'capa',
  'secao',
  'conteudo',
  'comparacao',
  'imagem-texto',
  'grade-cards',
  'indicadores',
  'grafico',
  'tabela',
  'citacao',
  'encerramento',
] as const;
export type Arquetipo = (typeof ARQUETIPOS)[number];

export interface SlideTemplate {
  /** 1-based, na ordem do arquivo. */
  indice: number;
  arquetipo: Arquetipo;
  elementos: ElementoTemplate[];
}

export interface LayoutRecorrente {
  arquetipo: Arquetipo;
  ocorrencias: number;
  /** Índices (1-based) dos slides com esse arquétipo. */
  slides: number[];
}

export interface TemplateEstrutura {
  /** Versão do formato deste documento, para migrações futuras do Json. */
  versaoFormato: 1;
  origem: 'pptx' | 'html';
  /** Dimensões nativas (EMU no pptx, px no html). */
  largura: number;
  altura: number;
  /** "16:9", "4:3", "1:1"… ou "1.60:1" quando não bate com um padrão. */
  proporcao: string;
  totalSlides: number;
  /** Só os primeiros LIMITE_SLIDES são analisados. */
  slides: SlideTemplate[];
  layoutsRecorrentes: LayoutRecorrente[];
  /** true no HTML: posições inferidas do fluxo, não medidas. */
  geometriaAproximada: boolean;
  /** Observações honestas sobre o que não pôde ser interpretado. */
  avisos: string[];
}

export const LIMITE_SLIDES = 60;
export const LIMITE_ELEMENTOS = 40;

/** Erro de processamento com mensagem pronta para o usuário. */
export class ErroProcessamento extends Error {}
