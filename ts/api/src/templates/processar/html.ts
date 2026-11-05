import JSZip from 'jszip';
import { parse, HTMLElement } from 'node-html-parser';
import {
  agruparLayouts,
  classificarSlide,
  normalizar,
  proporcaoDe,
} from './arquetipo';
import {
  ErroProcessamento,
  LIMITE_ELEMENTOS,
  LIMITE_SLIDES,
  type ElementoTemplate,
  type SlideTemplate,
  type TemplateEstrutura,
  type TipoElemento,
} from './tipos';

/**
 * Leitor ESTRUTURAL de apresentações HTML (arquivo solto ou .zip com recursos).
 *
 * Segurança: o HTML é só PARSEADO como texto — nenhum script roda, nada é
 * buscado da rede, e `<script>`, `<iframe>`, `<object>` e `<embed>` são
 * descartados antes da análise. Do zip só os .html são descompactados (com
 * teto de tamanho); imagens e fontes são apenas contadas.
 *
 * Sem um motor de layout, a geometria é INFERIDA: posições absolutas em
 * estilo inline são respeitadas; o resto é distribuído pelo fluxo (blocos
 * empilhados, contêineres flex/grid/colunas lado a lado). Por isso
 * `geometriaAproximada: true`.
 */

const LIMITE_HTML = 5 * 1024 * 1024;
const LIMITE_ENTRADAS_ZIP = 500;
const LARGURA_PADRAO = 1280;
const ALTURA_PADRAO = 720;

const PERIGOSOS = 'script, iframe, object, embed, noscript, template';
const IGNORADOS = new Set([
  'style',
  'link',
  'meta',
  'head',
  'title',
  'nav',
  'footer',
  'button',
  'input',
  'form',
  'br',
  'hr',
]);

export async function processarHtml(
  buffer: Buffer,
  nomeArquivo: string,
): Promise<TemplateEstrutura> {
  const avisos: string[] = [];
  let html: string;

  if (/\.zip$/i.test(nomeArquivo)) {
    html = await htmlDoZip(buffer, avisos);
  } else {
    if (buffer.length > LIMITE_HTML) {
      throw new ErroProcessamento('O arquivo HTML é grande demais.');
    }
    html = buffer.toString('utf8');
  }

  if (!/<[a-z!]/i.test(html)) {
    throw new ErroProcessamento('O arquivo não parece ser um documento HTML.');
  }

  let raiz: HTMLElement;
  try {
    raiz = parse(html, { comment: false });
  } catch {
    throw new ErroProcessamento('Não foi possível ler o HTML enviado.');
  }

  const scripts = raiz.querySelectorAll('script').length;
  raiz.querySelectorAll(PERIGOSOS).forEach((n) => n.remove());
  if (scripts) {
    avisos.push(`${scripts} script(s) foram ignorados — nada do arquivo é executado.`);
  }

  const externos = raiz
    .querySelectorAll('img[src], link[href], source[src]')
    .map((n) => n.getAttribute('src') ?? n.getAttribute('href') ?? '')
    .filter((u) => /^(https?:)?\/\//i.test(u)).length;
  if (externos) {
    avisos.push(
      `${externos} recurso(s) externo(s) referenciado(s) não foram baixados.`,
    );
  }

  const corpo = raiz.querySelector('body') ?? raiz;
  const blocos = encontrarSlides(corpo);
  if (!blocos.length) {
    throw new ErroProcessamento(
      'Não foi possível identificar slides neste HTML.',
    );
  }
  if (blocos.length > LIMITE_SLIDES) {
    avisos.push(
      `Só os primeiros ${LIMITE_SLIDES} de ${blocos.length} slides foram analisados.`,
    );
  }

  const { largura, altura } = dimensoes(blocos[0]);
  const analisados = blocos.slice(0, LIMITE_SLIDES);

  const slides: SlideTemplate[] = analisados.map((bloco, i) => {
    const brutos: ElementoTemplate[] = [];
    distribuir(bloco, { x: 0.06, y: 0.08, w: 0.88, h: 0.84 }, brutos, {
      largura,
      altura,
    });
    // O primeiro cabeçalho é o título; os outros, subtítulos.
    let viuTitulo = false;
    for (const e of brutos) {
      if (e.tipo !== 'titulo') continue;
      if (viuTitulo) e.tipo = 'subtitulo';
      viuTitulo = true;
    }
    const elementos = brutos
      .map(normalizar)
      .filter((e): e is ElementoTemplate => !!e)
      .slice(0, LIMITE_ELEMENTOS);
    return {
      indice: i + 1,
      arquetipo: classificarSlide(elementos, {
        indice: i + 1,
        total: analisados.length,
      }),
      elementos,
    };
  });

  return {
    versaoFormato: 1,
    origem: 'html',
    largura,
    altura,
    proporcao: proporcaoDe(largura, altura),
    totalSlides: blocos.length,
    slides,
    layoutsRecorrentes: agruparLayouts(slides),
    geometriaAproximada: true,
    avisos,
  };
}

async function htmlDoZip(buffer: Buffer, avisos: string[]): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ErroProcessamento('O arquivo .zip é inválido ou está corrompido.');
  }
  const entradas = Object.values(zip.files).filter((f) => !f.dir);
  if (entradas.length > LIMITE_ENTRADAS_ZIP) {
    throw new ErroProcessamento(
      `O pacote tem arquivos demais (máximo ${LIMITE_ENTRADAS_ZIP}).`,
    );
  }
  const htmls = entradas
    .filter((f) => /\.html?$/i.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name))
    .sort((a, b) => {
      const prof = (n: string) => n.split('/').length;
      const idx = (n: string) => (/(^|\/)index\.html?$/i.test(n) ? 0 : 1);
      return prof(a.name) - prof(b.name) || idx(a.name) - idx(b.name);
    });
  const principal = htmls[0];
  if (!principal) {
    throw new ErroProcessamento('O pacote .zip não contém um arquivo HTML.');
  }
  // Tamanho declarado no diretório do zip — barra "zip bomb" antes de inflar.
  const declarado = (principal as unknown as { _data?: { uncompressedSize?: number } })
    ._data?.uncompressedSize;
  if (declarado !== undefined && declarado > LIMITE_HTML) {
    throw new ErroProcessamento('O HTML dentro do pacote é grande demais.');
  }
  const html = await principal.async('string');
  if (html.length > LIMITE_HTML) {
    throw new ErroProcessamento('O HTML dentro do pacote é grande demais.');
  }

  const imagens = entradas.filter((f) => /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(f.name)).length;
  const fontes = entradas.filter((f) => /\.(woff2?|ttf|otf|eot)$/i.test(f.name)).length;
  if (imagens || fontes) {
    avisos.push(
      `Pacote com ${imagens} imagem(ns) e ${fontes} fonte(s) auxiliares. As posições das imagens foram consideradas; as fontes não, porque a tipografia vem da identidade visual.`,
    );
  }
  return html;
}

/** Elementos filhos (ignora nós de texto). */
const filhos = (el: HTMLElement): HTMLElement[] =>
  el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);

function encontrarSlides(corpo: HTMLElement): HTMLElement[] {
  for (const seletor of ['[data-slide]', '.slide', 'section']) {
    const achados = corpo
      .querySelectorAll(seletor)
      // reveal.js aninha <section> verticais: fica só com as folhas.
      .filter((el) => !el.querySelector(seletor));
    if (achados.length) return achados;
  }
  const diretos = filhos(corpo).filter((el) => !IGNORADOS.has(el.tagName.toLowerCase()));
  if (diretos.length >= 2) return diretos;
  return [corpo];
}

function estilo(el: HTMLElement): Record<string, string> {
  const s: Record<string, string> = {};
  for (const par of (el.getAttribute('style') ?? '').split(';')) {
    const [k, ...v] = par.split(':');
    if (k && v.length) s[k.trim().toLowerCase()] = v.join(':').trim().toLowerCase();
  }
  return s;
}

function px(v: string | undefined): number | undefined {
  const m = v?.match(/^(-?[\d.]+)px$/);
  return m ? Number(m[1]) : undefined;
}

function dimensoes(slide: HTMLElement): { largura: number; altura: number } {
  const s = estilo(slide);
  const w = px(s.width) ?? Number(slide.getAttribute('data-width'));
  const h = px(s.height) ?? Number(slide.getAttribute('data-height'));
  if (w > 0 && h > 0) return { largura: w, altura: h };
  const ar = s['aspect-ratio']?.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (ar) {
    return { largura: LARGURA_PADRAO, altura: (LARGURA_PADRAO * Number(ar[2])) / Number(ar[1]) };
  }
  return { largura: LARGURA_PADRAO, altura: ALTURA_PADRAO };
}

function tipoFolha(el: HTMLElement): TipoElemento | null {
  const tag = el.tagName.toLowerCase();
  const classe = (el.getAttribute('class') ?? '').toLowerCase();
  if (tag === 'h1' || tag === 'h2') return 'titulo';
  if (/^h[3-6]$/.test(tag)) return 'subtitulo';
  if (['img', 'picture', 'video', 'figure'].includes(tag)) return 'imagem';
  if (tag === 'svg' || tag === 'canvas' || /chart|grafico|graph/.test(classe)) {
    return 'grafico';
  }
  if (tag === 'table') return 'tabela';
  if (['p', 'ul', 'ol', 'blockquote', 'dl', 'pre'].includes(tag)) return 'texto';
  if (/(^|[\s_-])(kpi|metric|stat|numero|number)/.test(classe)) return 'texto';
  return null;
}

/** Peso vertical de cada bloco ao empilhar (quanto espaço costuma ocupar). */
function peso(el: HTMLElement): number {
  const t = tipoFolha(el);
  if (t === 'titulo') return 1;
  if (t === 'subtitulo') return 0.7;
  if (t === 'imagem' || t === 'grafico' || t === 'tabela') return 3;
  if (t === 'texto') {
    const itens = el.querySelectorAll('li').length;
    return Math.min(3, 1 + itens * 0.35 + el.textContent.length / 400);
  }
  return Math.max(1, filhos(el).reduce((s, f) => s + peso(f), 0));
}

function ehLinha(el: HTMLElement): boolean {
  const s = estilo(el);
  const classe = (el.getAttribute('class') ?? '').toLowerCase();
  if (s.display?.includes('flex') && !s['flex-direction']?.startsWith('column')) {
    return true;
  }
  if (s.display?.includes('grid') && s['grid-template-columns']) return true;
  return /(^|[\s_-])(row|cols?|columns|grid|split|two|three|cards|side-by-side|flex)($|[\s_-])/.test(
    classe,
  );
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

function posicaoAbsoluta(
  el: HTMLElement,
  dim: { largura: number; altura: number },
): Area | null {
  const s = estilo(el);
  if (s.position !== 'absolute') return null;
  const frac = (v: string | undefined, total: number) => {
    if (!v) return undefined;
    const pct = v.match(/^(-?[\d.]+)%$/);
    if (pct) return Number(pct[1]) / 100;
    const p = px(v);
    return p !== undefined ? p / total : undefined;
  };
  const x = frac(s.left, dim.largura);
  const y = frac(s.top, dim.altura);
  const w = frac(s.width, dim.largura);
  const h = frac(s.height, dim.altura);
  if ([x, y, w, h].some((n) => n === undefined)) return null;
  return { x: x!, y: y!, w: w!, h: h! };
}

function distribuir(
  el: HTMLElement,
  area: Area,
  saida: ElementoTemplate[],
  dim: { largura: number; altura: number },
): void {
  const blocos = filhos(el).filter(
    (f) => !IGNORADOS.has(f.tagName.toLowerCase()) && conteudo(f),
  );
  if (!blocos.length) return;

  const lado = ehLinha(el) && blocos.length > 1;
  const total = lado ? blocos.length : blocos.reduce((s, b) => s + peso(b), 0);
  // Sem motor de layout, um <p> curto não deve "esticar" até o fim do slide:
  // cada unidade de peso ocupa no máximo ~13% da altura.
  const unidade = lado ? 0 : Math.min(area.h / total, 0.13);
  let cursor = 0;

  for (const b of blocos) {
    const fatia = lado ? 1 : peso(b);
    const sub: Area = posicaoAbsoluta(b, dim) ?? (lado
      ? {
          x: area.x + (cursor / total) * area.w,
          y: area.y,
          w: (area.w / total) * 0.94,
          h: area.h,
        }
      : {
          x: area.x,
          y: area.y + cursor * unidade,
          w: area.w,
          h: fatia * unidade * 0.94,
        });
    cursor += fatia;

    const tipo = tipoFolha(b);
    if (tipo) saida.push({ tipo, ...sub });
    else if (filhos(b).length) distribuir(b, sub, saida, dim);
    // <div>Texto solto</div>: bloco de texto sem tag semântica.
    else saida.push({ tipo: 'texto', ...sub });
  }
}

/** Ignora contêineres vazios (decorativos) ao distribuir o espaço. */
function conteudo(el: HTMLElement): boolean {
  if (tipoFolha(el)) return true;
  if (el.textContent.trim()) return true;
  return !!el.querySelector('img, svg, canvas, table, video, picture');
}
