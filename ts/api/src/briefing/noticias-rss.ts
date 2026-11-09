// ----------------------------------------------------------------------
// Notícias do Resumo Matinal — Google Notícias RSS (gratuito, sem chave).
// Manchetes reais com fonte, link e data; a IA só escolhe e resume.
// ----------------------------------------------------------------------

export interface NoticiaBruta {
  titulo: string;
  fonte: string;
  link: string;
  publicadoEm: string;
  /** Interesse/objetivo que originou a busca. */
  tema: string;
}

const TIMEOUT_MS = 8000;
const POR_TEMA = 5;
/** Notícia mais velha que isso não entra (fica "datada" no briefing). */
const JANELA_MS = 48 * 3600_000;

function decodificar(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(item: string, nome: string): string {
  const m = item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'));
  return m ? decodificar(m[1]) : '';
}

async function buscarTema(tema: string, idioma: 'pt' | 'en'): Promise<NoticiaBruta[]> {
  const loc = idioma === 'en' ? { hl: 'en-US', gl: 'US', ceid: 'US:en' } : { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' };
  const params = new URLSearchParams({ q: `${tema} when:2d`, ...loc });
  const r = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OracleBriefing/1.0)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();
  const itens = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const limite = Date.now() - JANELA_MS;
  const out: NoticiaBruta[] = [];
  for (const it of itens) {
    const fonte = tag(it, 'source');
    let titulo = tag(it, 'title');
    // O Google anexa " - Fonte" ao título.
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3)).trim();
    const link = tag(it, 'link');
    const data = new Date(tag(it, 'pubDate'));
    if (!titulo || !/^https?:\/\//.test(link) || Number.isNaN(data.getTime())) continue;
    if (data.getTime() < limite) continue;
    out.push({ titulo, fonte: fonte || 'Google Notícias', link, publicadoEm: data.toISOString(), tema });
    if (out.length >= POR_TEMA) break;
  }
  return out;
}

/** Busca por tema em paralelo; um tema com falha não derruba os outros. */
export async function buscarNoticias(
  temas: string[],
  idioma: 'pt' | 'en',
): Promise<{ noticias: NoticiaBruta[]; falhas: number }> {
  const res = await Promise.allSettled(temas.map((t) => buscarTema(t, idioma)));
  const vistos = new Set<string>();
  const noticias: NoticiaBruta[] = [];
  let falhas = 0;
  for (const r of res) {
    if (r.status === 'rejected') {
      falhas++;
      continue;
    }
    for (const n of r.value) {
      const chave = n.titulo.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      noticias.push(n);
    }
  }
  return { noticias, falhas };
}
