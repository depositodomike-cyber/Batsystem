import * as path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
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
 * Leitor ESTRUTURAL de .pptx: abre o zip e lê o XML do OOXML. Não executa nada,
 * não renderiza e não guarda texto. De cada slide sai só a lista de caixas
 * (título, texto, imagem, gráfico, tabela) com posição relativa.
 *
 * Caixas de placeholder sem posição própria herdam a do layout e, se preciso,
 * a do master, exatamente como o PowerPoint resolve.
 */

type No = Record<string, any>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

const lista = <T>(v: T | T[] | undefined): T[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placeholder {
  tipo?: string;
  idx?: string;
}

/** Posição + placeholder de cada forma de um layout/master, para herança. */
interface MapaPlaceholders {
  porTipo: Map<string, Caixa>;
  porIdx: Map<string, Caixa>;
}

export async function processarPptx(buffer: Buffer): Promise<TemplateEstrutura> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ErroProcessamento(
      'O arquivo não é um PowerPoint válido ou está corrompido.',
    );
  }

  const ler = async (caminho: string): Promise<No | null> => {
    const f = zip.file(caminho);
    if (!f) return null;
    try {
      return parser.parse(await f.async('string')) as No;
    } catch {
      return null;
    }
  };

  const apresentacao = await ler('ppt/presentation.xml');
  if (!apresentacao?.['p:presentation']) {
    throw new ErroProcessamento(
      'O arquivo não contém uma apresentação do PowerPoint (.pptx).',
    );
  }
  const pres = apresentacao['p:presentation'];
  const largura = Number(pres['p:sldSz']?.['@_cx']) || 12192000;
  const altura = Number(pres['p:sldSz']?.['@_cy']) || 6858000;

  const relsPres = await relacoes(ler, 'ppt/presentation.xml');
  const ids = lista<No>(pres['p:sldIdLst']?.['p:sldId']);
  const caminhosSlides = ids
    .map((s) => relsPres.get(s['@_r:id']))
    .filter((c): c is string => !!c);

  if (!caminhosSlides.length) {
    throw new ErroProcessamento('A apresentação não tem nenhum slide.');
  }

  const avisos: string[] = [];
  if (caminhosSlides.length > LIMITE_SLIDES) {
    avisos.push(
      `Só os primeiros ${LIMITE_SLIDES} de ${caminhosSlides.length} slides foram analisados.`,
    );
  }

  const cacheLayouts = new Map<
    string,
    { mapa: MapaPlaceholders; tipo?: string; master?: MapaPlaceholders }
  >();
  const cacheMasters = new Map<string, MapaPlaceholders>();

  const carregarLayout = async (caminho: string) => {
    const emCache = cacheLayouts.get(caminho);
    if (emCache) return emCache;
    const xml = await ler(caminho);
    const layout = xml?.['p:sldLayout'];
    const mapa = mapaPlaceholders(layout?.['p:cSld']?.['p:spTree']);
    let master: MapaPlaceholders | undefined;
    const caminhoMaster = [...(await relacoes(ler, caminho, 'slideMaster')).values()][0];
    if (caminhoMaster) {
      master = cacheMasters.get(caminhoMaster);
      if (!master) {
        const xmlM = await ler(caminhoMaster);
        master = mapaPlaceholders(
          xmlM?.['p:sldMaster']?.['p:cSld']?.['p:spTree'],
        );
        cacheMasters.set(caminhoMaster, master);
      }
    }
    const item = { mapa, tipo: layout?.['@_type'] as string | undefined, master };
    cacheLayouts.set(caminho, item);
    return item;
  };

  const analisados = caminhosSlides.slice(0, LIMITE_SLIDES);
  const slides: SlideTemplate[] = [];
  let falhas = 0;

  for (let i = 0; i < analisados.length; i++) {
    const caminho = analisados[i];
    const xml = await ler(caminho);
    const arvore = xml?.['p:sld']?.['p:cSld']?.['p:spTree'];
    if (!arvore) {
      falhas++;
      continue;
    }
    const caminhoLayout = [...(await relacoes(ler, caminho, 'slideLayout')).values()][0];
    const layout = caminhoLayout ? await carregarLayout(caminhoLayout) : undefined;

    const herdar = (ph: Placeholder): Caixa | undefined => {
      for (const m of [layout?.mapa, layout?.master]) {
        if (!m) continue;
        const achada =
          (ph.idx && m.porIdx.get(ph.idx)) ||
          (ph.tipo && m.porTipo.get(normalizarTipoPh(ph.tipo)));
        if (achada) return achada;
      }
      return undefined;
    };

    const brutos: ElementoTemplate[] = [];
    coletar(arvore, null, brutos, herdar);

    const elementos = brutos
      .map((e) => normalizar({ ...e, x: e.x / largura, y: e.y / altura, w: e.w / largura, h: e.h / altura }))
      .filter((e): e is ElementoTemplate => !!e)
      // Fundo/moldura que cobre quase o slide inteiro não é composição.
      .filter((e) => !(e.tipo === 'forma' && e.w * e.h > 0.8))
      .slice(0, LIMITE_ELEMENTOS);

    slides.push({
      indice: i + 1,
      arquetipo: classificarSlide(elementos, {
        indice: i + 1,
        total: analisados.length,
        tipoLayout: layout?.tipo,
      }),
      elementos,
    });
  }

  if (!slides.length) {
    throw new ErroProcessamento(
      'Não foi possível ler os slides deste PowerPoint.',
    );
  }
  if (falhas) {
    avisos.push(`${falhas} slide(s) não puderam ser lidos e foram ignorados.`);
  }

  return {
    versaoFormato: 1,
    origem: 'pptx',
    largura,
    altura,
    proporcao: proporcaoDe(largura, altura),
    totalSlides: caminhosSlides.length,
    slides,
    layoutsRecorrentes: agruparLayouts(slides),
    geometriaAproximada: false,
    avisos,
  };
}

/** Lê o .rels de uma parte e devolve Id → caminho absoluto no zip. */
async function relacoes(
  ler: (c: string) => Promise<No | null>,
  parte: string,
  tipoTerminaCom?: string,
): Promise<Map<string, string>> {
  const dir = path.posix.dirname(parte);
  const rels = await ler(`${dir}/_rels/${path.posix.basename(parte)}.rels`);
  const mapa = new Map<string, string>();
  for (const r of lista<No>(rels?.['Relationships']?.['Relationship'])) {
    if (tipoTerminaCom && !String(r['@_Type'] ?? '').endsWith(`/${tipoTerminaCom}`)) {
      continue;
    }
    if (r['@_TargetMode'] === 'External') continue;
    const alvo = String(r['@_Target'] ?? '');
    const absoluto = alvo.startsWith('/')
      ? alvo.slice(1)
      : path.posix.normalize(path.posix.join(dir, alvo));
    mapa.set(String(r['@_Id']), absoluto);
  }
  return mapa;
}

function caixaDe(xfrm: No | undefined): Caixa | undefined {
  const off = xfrm?.['a:off'];
  const ext = xfrm?.['a:ext'];
  if (!off || !ext) return undefined;
  const c = {
    x: Number(off['@_x']),
    y: Number(off['@_y']),
    w: Number(ext['@_cx']),
    h: Number(ext['@_cy']),
  };
  return [c.x, c.y, c.w, c.h].every(Number.isFinite) ? c : undefined;
}

/** "ctrTitle" e "title" são o mesmo slot para herança; idem "subTitle"/"body". */
function normalizarTipoPh(tipo: string): string {
  if (tipo === 'ctrTitle') return 'title';
  return tipo;
}

function placeholderDe(nv: No | undefined): Placeholder | null {
  const ph = nv?.['p:nvPr']?.['p:ph'];
  if (ph === undefined) return null;
  // `<p:ph/>` sem atributos chega como string vazia.
  if (typeof ph !== 'object') return { tipo: 'body' };
  return {
    tipo: (ph['@_type'] as string | undefined) ?? 'body',
    idx: ph['@_idx'] as string | undefined,
  };
}

function mapaPlaceholders(arvore: No | undefined): MapaPlaceholders {
  const porTipo = new Map<string, Caixa>();
  const porIdx = new Map<string, Caixa>();
  for (const sp of lista<No>(arvore?.['p:sp'])) {
    const ph = placeholderDe(sp['p:nvSpPr']);
    const caixa = caixaDe(sp['p:spPr']?.['a:xfrm']);
    if (!ph || !caixa) continue;
    if (ph.tipo) {
      const t = normalizarTipoPh(ph.tipo);
      if (!porTipo.has(t)) porTipo.set(t, caixa);
    }
    if (ph.idx) porIdx.set(ph.idx, caixa);
  }
  return { porTipo, porIdx };
}

/** Procura recursivamente qualquer nó com a chave pedida. */
function busca(no: unknown, chave: string, achados: unknown[] = []): unknown[] {
  if (!no || typeof no !== 'object') return achados;
  for (const [k, v] of Object.entries(no as No)) {
    if (k === chave) achados.push(...lista(v));
    if (v && typeof v === 'object') busca(v, chave, achados);
  }
  return achados;
}

function temTexto(txBody: No | undefined): boolean {
  return busca(txBody, 'a:t').some((t) => {
    const s = typeof t === 'object' ? (t as No)['#text'] : t;
    return String(s ?? '').trim().length > 0;
  });
}

/** Maior tamanho de fonte (centésimos de pt) usado no corpo de texto. */
function maiorFonte(txBody: No | undefined): number {
  return busca(txBody, 'a:rPr')
    .concat(busca(txBody, 'a:defRPr'))
    .reduce<number>((m, r) => {
      const sz = Number((r as No)?.['@_sz']);
      return Number.isFinite(sz) ? Math.max(m, sz) : m;
    }, 0);
}

function tipoDoPlaceholder(tipo: string): TipoElemento | null {
  switch (tipo) {
    case 'title':
    case 'ctrTitle':
      return 'titulo';
    case 'subTitle':
      return 'subtitulo';
    case 'pic':
      return 'imagem';
    case 'chart':
      return 'grafico';
    case 'tbl':
      return 'tabela';
    case 'dt':
    case 'ftr':
    case 'sldNum':
    case 'hdr':
      return null; // rodapés e numeração não são composição
    default:
      return 'texto';
  }
}

/**
 * Transforma de grupo: filhos de `p:grpSp` usam o espaço `chOff/chExt` do
 * grupo, que precisa ser mapeado para `off/ext`.
 */
type Transforma = ((c: Caixa) => Caixa) | null;

function coletar(
  arvore: No,
  transforma: Transforma,
  saida: ElementoTemplate[],
  herdar: (ph: Placeholder) => Caixa | undefined,
): void {
  const aplicar = (c: Caixa) => (transforma ? transforma(c) : c);

  for (const sp of lista<No>(arvore['p:sp'])) {
    const ph = placeholderDe(sp['p:nvSpPr']);
    const propria = caixaDe(sp['p:spPr']?.['a:xfrm']);
    const caixa = propria ?? (ph ? herdar(ph) : undefined);
    if (!caixa) continue;

    let tipo: TipoElemento | null;
    if (ph) {
      tipo = tipoDoPlaceholder(ph.tipo ?? 'body');
      // Placeholder de corpo vazio no slide é só um slot não usado.
      if (tipo === 'texto' && !temTexto(sp['p:txBody'])) continue;
    } else if (temTexto(sp['p:txBody'])) {
      // Caixa de texto livre: fonte ≥ 28pt na metade de cima vira título.
      tipo = maiorFonte(sp['p:txBody']) >= 2800 ? 'titulo' : 'texto';
    } else {
      tipo = 'forma';
    }
    if (tipo) saida.push({ tipo, ...aplicar(caixa) });
  }

  for (const pic of lista<No>(arvore['p:pic'])) {
    const caixa = caixaDe(pic['p:spPr']?.['a:xfrm']);
    if (caixa) saida.push({ tipo: 'imagem', ...aplicar(caixa) });
  }

  for (const gf of lista<No>(arvore['p:graphicFrame'])) {
    const caixa = caixaDe(gf['p:xfrm']);
    if (!caixa) continue;
    const uri = String(gf['a:graphic']?.['a:graphicData']?.['@_uri'] ?? '');
    const tipo: TipoElemento = uri.includes('/table')
      ? 'tabela'
      : uri.includes('chart')
        ? 'grafico'
        : 'forma';
    saida.push({ tipo, ...aplicar(caixa) });
  }

  for (const grp of lista<No>(arvore['p:grpSp'])) {
    const xfrm = grp['p:grpSpPr']?.['a:xfrm'];
    const fora = caixaDe(xfrm);
    const chOff = xfrm?.['a:chOff'];
    const chExt = xfrm?.['a:chExt'];
    let interna: Transforma = transforma;
    if (fora && chOff && chExt) {
      const cx = Number(chOff['@_x']);
      const cy = Number(chOff['@_y']);
      const sx = fora.w / (Number(chExt['@_cx']) || fora.w || 1);
      const sy = fora.h / (Number(chExt['@_cy']) || fora.h || 1);
      interna = (c: Caixa) =>
        aplicar({
          x: fora.x + (c.x - cx) * sx,
          y: fora.y + (c.y - cy) * sy,
          w: c.w * sx,
          h: c.h * sy,
        });
    }
    coletar(grp, interna, saida, herdar);
  }
}
