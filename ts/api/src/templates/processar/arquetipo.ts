import type {
  Arquetipo,
  ElementoTemplate,
  LayoutRecorrente,
  SlideTemplate,
} from './tipos';

/**
 * Classificação DETERMINÍSTICA do arquétipo de um slide a partir das caixas.
 * Nada de IA aqui: o resultado do processamento precisa ser reprodutível e não
 * pode inventar o que o arquivo não tem.
 */

const TEXTUAIS = new Set(['texto', 'subtitulo']);

const area = (e: ElementoTemplate) => e.w * e.h;

/**
 * Tipos de layout do OOXML (atributo `type` de `p:sldLayout`) que já dizem o
 * arquétipo com segurança. Os demais (obj, tx, titleOnly, blank, cust…) não
 * dizem nada além de "conteúdo" — aí decide a geometria.
 */
const POR_LAYOUT_PPTX: Record<string, Arquetipo> = {
  title: 'capa',
  secHead: 'secao',
  twoTxTwoObj: 'comparacao',
  twoObj: 'comparacao',
  twoColTx: 'comparacao',
  picTx: 'imagem-texto',
  chart: 'grafico',
  chartAndTx: 'grafico',
  txAndChart: 'grafico',
  tbl: 'tabela',
};

/**
 * Agrupa caixas em "linhas" pela sobreposição vertical: duas caixas estão na
 * mesma linha quando o centro de uma cai dentro da faixa da outra.
 */
function linhas(caixas: ElementoTemplate[]): ElementoTemplate[][] {
  const ordenadas = [...caixas].sort((a, b) => a.y - b.y);
  const grupos: ElementoTemplate[][] = [];
  for (const c of ordenadas) {
    const centro = c.y + c.h / 2;
    const alvo = grupos.find((g) =>
      g.some((o) => centro >= o.y && centro <= o.y + o.h),
    );
    if (alvo) alvo.push(c);
    else grupos.push([c]);
  }
  return grupos;
}

export function classificarSlide(
  elementos: ElementoTemplate[],
  posicao: { indice: number; total: number; tipoLayout?: string },
): Arquetipo {
  const porLayout = posicao.tipoLayout
    ? POR_LAYOUT_PPTX[posicao.tipoLayout]
    : undefined;
  if (porLayout) return porLayout;

  const titulos = elementos.filter((e) => e.tipo === 'titulo');
  const textos = elementos.filter((e) => TEXTUAIS.has(e.tipo));
  const imagens = elementos.filter((e) => e.tipo === 'imagem');
  const graficos = elementos.filter((e) => e.tipo === 'grafico');
  const tabelas = elementos.filter((e) => e.tipo === 'tabela');
  const ultimo = posicao.indice === posicao.total && posicao.total > 2;

  if (graficos.length) return 'grafico';
  if (tabelas.length) return 'tabela';

  const imagemGrande = imagens.some((i) => area(i) >= 0.15);
  if (imagemGrande && textos.length + titulos.length > 0) return 'imagem-texto';

  // Caixas de texto (fora o título) dispostas lado a lado.
  const corpo = textos.filter((t) => t.h < 0.85);
  const grupos = linhas(corpo);
  const maiorLinha = grupos.reduce((m, g) => Math.max(m, g.length), 0);
  const linhasMultiplas = grupos.filter((g) => g.length >= 2).length;

  if (maiorLinha >= 3) {
    // Caixas baixas numa faixa só lembram números/KPIs; várias linhas de
    // caixas, uma grade de cards.
    const baixas = grupos
      .filter((g) => g.length >= 3)
      .every((g) => g.every((c) => c.h <= 0.3));
    if (linhasMultiplas >= 2) return 'grade-cards';
    return baixas ? 'indicadores' : 'grade-cards';
  }
  if (maiorLinha === 2 && linhasMultiplas >= 2) return 'grade-cards';
  if (maiorLinha === 2) return 'comparacao';

  // "Só título": nada de corpo de texto relevante (um subtítulo curto conta
  // como parte do título; um bloco de tópicos, não).
  const corpoGrande = textos.some((t) => area(t) >= 0.12);
  const soTitulo = !corpoGrande && textos.length <= 2 && imagens.length === 0;
  if (posicao.indice === 1 && titulos.length + textos.length > 0 && soTitulo) {
    return 'capa';
  }
  if (soTitulo && titulos.length) return ultimo ? 'encerramento' : 'secao';

  // Um bloco de texto grande e centralizado, sem título: citação/destaque.
  if (!titulos.length && textos.length === 1) {
    const t = textos[0];
    const centrado = Math.abs(t.x + t.w / 2 - 0.5) < 0.1;
    if (centrado && area(t) < 0.5) return 'citacao';
  }

  return 'conteudo';
}

export function agruparLayouts(slides: SlideTemplate[]): LayoutRecorrente[] {
  const mapa = new Map<Arquetipo, number[]>();
  for (const s of slides) {
    const lista = mapa.get(s.arquetipo) ?? [];
    lista.push(s.indice);
    mapa.set(s.arquetipo, lista);
  }
  return [...mapa.entries()]
    .map(([arquetipo, idx]) => ({
      arquetipo,
      ocorrencias: idx.length,
      slides: idx,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.slides[0] - b.slides[0]);
}

export function proporcaoDe(largura: number, altura: number): string {
  if (!largura || !altura) return '16:9';
  const r = largura / altura;
  const padroes: [string, number][] = [
    ['16:9', 16 / 9],
    ['16:10', 16 / 10],
    ['4:3', 4 / 3],
    ['1:1', 1],
    ['3:4', 3 / 4],
    ['9:16', 9 / 16],
    ['A4', 297 / 210],
  ];
  const achado = padroes.find(([, v]) => Math.abs(v - r) / v < 0.02);
  return achado ? achado[0] : `${r.toFixed(2)}:1`;
}

/** Arredonda e prende a [0,1] — o Json fica pequeno e à prova de lixo. */
export function normalizar(e: ElementoTemplate): ElementoTemplate | null {
  const r = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
  const x = r(e.x);
  const y = r(e.y);
  const w = r(Math.min(e.w, 1 - x));
  const h = r(Math.min(e.h, 1 - y));
  if (w <= 0.005 || h <= 0.005) return null;
  return { tipo: e.tipo, x, y, w, h };
}
