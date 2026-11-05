import { processarHtml } from './html';
import { processarPptx } from './pptx';
import { ErroProcessamento, type TemplateEstrutura } from './tipos';

export * from './tipos';
export { templateBrief, parseTemplateEstrutura } from './brief';

/** 4 MB: o corpo de requisição da função serverless na Vercel é ~4,5 MB. */
export const LIMITE_ARQUIVO_TEMPLATE = 4 * 1024 * 1024;

export type FormatoTemplate = 'pptx' | 'html';

const EXTENSOES: Record<string, FormatoTemplate> = {
  pptx: 'pptx',
  html: 'html',
  htm: 'html',
  zip: 'html',
};

const MIMES: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  html: 'text/html',
  htm: 'text/html',
  zip: 'application/zip',
};

/** "PK\x03\x04" (zip com entradas) ou "PK\x05\x06" (zip vazio). */
const ehZip = (b: Buffer) =>
  b[0] === 0x50 &&
  b[1] === 0x4b &&
  ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6));

/**
 * Valida extensão + assinatura e extrai a estrutura. Lança
 * `ErroProcessamento` com mensagem pronta para o usuário em qualquer falha.
 */
export async function processarTemplate(
  buffer: Buffer,
  nomeArquivo: string,
): Promise<{ formato: FormatoTemplate; mime: string; estrutura: TemplateEstrutura }> {
  const ext = nomeArquivo.split('.').pop()?.toLowerCase() ?? '';
  const formato = EXTENSOES[ext];
  if (!formato) {
    throw new ErroProcessamento(
      'Formato não suportado. Envie um arquivo .pptx, .html ou .zip (HTML com recursos).',
    );
  }
  if (!buffer.length) throw new ErroProcessamento('O arquivo está vazio.');
  if (buffer.length > LIMITE_ARQUIVO_TEMPLATE) {
    throw new ErroProcessamento('O arquivo passa do limite de 4 MB.');
  }
  // .pptx e .zip são zips: a extensão sozinha não basta.
  if ((ext === 'pptx' || ext === 'zip') && !ehZip(buffer)) {
    throw new ErroProcessamento(
      'O conteúdo do arquivo não corresponde à extensão informada.',
    );
  }

  const estrutura =
    formato === 'pptx'
      ? await processarPptx(buffer)
      : await processarHtml(buffer, nomeArquivo);

  return { formato, mime: MIMES[ext], estrutura };
}

export { ErroProcessamento };
