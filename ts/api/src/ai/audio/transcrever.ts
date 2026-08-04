// Transcrição de áudio por STT. No beculture/Confi roda o Whisper local; no web
// usamos a API de transcrição da OpenAI (whisper-1). Nada roda no host.
import OpenAI, { toFile } from 'openai';

export async function transcreverAudioOpenAI(
  apiKey: string,
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const file = await toFile(buffer, filename || 'audio.mp3');
  const resp = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });
  return (resp.text || '').trim();
}
