// Geração de imagens por IA (OpenAI gpt-image-1 / DALL·E). Portado do
// beculture/Confi (lib/imagem.js, provedor "openai" — o motor completo).
// O provedor HeyGen (foto de pessoas) fica para depois.
import OpenAI from 'openai';

export type ModeloImagem = 'gpt-image-1' | 'dall-e-3' | 'dall-e-2';

export const OPENAI_SIZES: Record<ModeloImagem, string[]> = {
  'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
  'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
  'dall-e-2': ['256x256', '512x512', '1024x1024'],
};

export interface ImagemSpec {
  prompt: string;
  modelo: ModeloImagem;
  size?: string;
  quality?: string;
  style?: string;
  background?: string;
  formato?: string; // png | jpeg | webp (gpt-image-1)
  n?: number;
}

export async function gerarImagensOpenAI(
  apiKey: string,
  spec: ImagemSpec,
): Promise<{ images: string[]; formato: string }> {
  const client = new OpenAI({ apiKey });
  const modelo: ModeloImagem = (['gpt-image-1', 'dall-e-3', 'dall-e-2'] as const).includes(
    spec.modelo,
  )
    ? spec.modelo
    : 'gpt-image-1';
  const sizesOk = OPENAI_SIZES[modelo];
  const size = spec.size && sizesOk.includes(spec.size) ? spec.size : sizesOk[0];
  const maxN = modelo === 'dall-e-3' ? 1 : 4;
  const n = Math.max(1, Math.min(maxN, Math.round(Number(spec.n) || 1)));

  // Corpo montado por modelo (parâmetros diferem entre gpt-image-1 e DALL·E).
  const body: Record<string, unknown> = { model: modelo, prompt: spec.prompt, size, n };
  let formato = 'png';
  if (modelo === 'dall-e-3') {
    if (['standard', 'hd'].includes(spec.quality || '')) body.quality = spec.quality;
    if (['vivid', 'natural'].includes(spec.style || '')) body.style = spec.style;
    body.response_format = 'b64_json';
    body.n = 1;
  } else if (modelo === 'dall-e-2') {
    body.response_format = 'b64_json';
  } else {
    // gpt-image-1 sempre devolve b64_json; aceita quality/background/output_format.
    if (['low', 'medium', 'high', 'auto'].includes(spec.quality || '')) body.quality = spec.quality;
    if (['transparent', 'opaque', 'auto'].includes(spec.background || '')) body.background = spec.background;
    if (['png', 'jpeg', 'webp'].includes(spec.formato || '')) body.output_format = spec.formato;
    if (body.background === 'transparent' && body.output_format === 'jpeg') body.output_format = 'png';
    formato = (body.output_format as string) || 'png';
  }

  const resp = (await client.images.generate(
    body as unknown as Parameters<typeof client.images.generate>[0],
  )) as unknown as { data?: Array<{ b64_json?: string }> };
  const images = (resp.data || [])
    .map((d) => d.b64_json)
    .filter((b): b is string => !!b);
  return { images, formato };
}
