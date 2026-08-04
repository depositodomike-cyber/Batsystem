// Extração de texto de um arquivo enviado (buffer + nome original) e de links.
// Portado do beculture/Confi (lib/extrair-texto.js), adaptado para buffers em
// memória (o multer do NestJS entrega file.buffer).
import { extname } from 'node:path';
import mammoth from 'mammoth';

const TEXTO_PURO = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.log', '.text']);

/** Devolve o texto de um arquivo, escolhendo o parser pela extensão. */
export async function extrairTexto(buffer: Buffer, nomeOriginal = ''): Promise<string> {
  const ext = extname(nomeOriginal).toLowerCase();

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    return (value || '').trim();
  }

  if (ext === '.pdf') {
    // Import tardio: o pdf-parse (via pdfjs-dist) carrega pesado e falha no
    // boot em algumas versões do Node; só o exigimos quando há um PDF de fato.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      return (text || '')
        .replace(/^-- \d+ of \d+ --$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (ext === '.doc') {
    throw new Error('Formato .doc antigo não é suportado. Converta para .docx ou .pdf.');
  }

  // Texto puro (extensões conhecidas ou qualquer outra) — decodifica como UTF-8.
  if (TEXTO_PURO.has(ext) || !ext) return buffer.toString('utf8').trim();
  return buffer.toString('utf8').trim();
}

/** Busca uma URL e devolve o texto visível (remove scripts/estilos/tags). */
export async function textoDeLink(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; BecultureBot/1.0)' },
      redirect: 'follow',
    });
  } catch {
    throw new Error('Não foi possível acessar o link.');
  }
  if (!res.ok) throw new Error(`O link retornou status ${res.status}.`);
  const ctype = res.headers.get('content-type') || '';
  const raw = await res.text();
  if (ctype.includes('application/json')) return raw.slice(0, 200000);
  const texto = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return texto;
}
