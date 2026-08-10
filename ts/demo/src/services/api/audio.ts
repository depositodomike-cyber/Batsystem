import axios from "@/utils/axios";

// Upload Áudio (IA) — chama o backend ts/api (POST /ai/audio, multipart). O
// áudio é transcrito (OpenAI Whisper) e vira um RESUMO (terminando com as
// conexões Obsidian) salvo no Repositório (Reuniões).

export interface AudioResult {
  titulo: string;
  resumo: string;
  transcricao: string;
  salvo: boolean;
  memoriaId?: string;
}

export async function transcreverAudioApi(file: File): Promise<AudioResult> {
  const fd = new FormData();
  fd.append("audio", file);
  const { data } = await axios.post<AudioResult>("/ai/audio", fd);
  return data;
}
