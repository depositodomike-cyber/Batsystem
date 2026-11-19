// Transcrição de áudio por STT. No Oracle/Confi roda o Whisper local; no web
// usamos a API de transcrição da OpenAI (whisper-1). Nada roda no host.
import OpenAI, { toFile } from 'openai';

export async function transcreverAudioOpenAI(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  /** Idioma ISO-639-1 ("pt", "en"); melhora a precisão em trechos curtos. */
  idioma?: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const file = await toFile(buffer, filename || 'audio.mp3');
  const resp = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    ...(idioma ? { language: idioma } : {}),
  });
  return (resp.text || '').trim();
}
