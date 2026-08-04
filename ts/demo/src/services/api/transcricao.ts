import axios from "@/utils/axios";

// Upload Transcrição (IA) — chama o backend ts/api (POST /ai/transcricao,
// multipart). Gera uma ATA estratégica detalhada a partir de uma transcrição e
// a SALVA na Memória (Reuniões). Portado do beculture/Confi.

export interface AtaTranscricao {
  titulo: string;
  ata: string;
  salvo: boolean;
  memoriaId?: string;
}

export async function gerarTranscricaoApi(p: {
  arquivo?: File | null;
  texto?: string;
  instrucoes?: string;
}): Promise<AtaTranscricao> {
  const fd = new FormData();
  if (p.arquivo) fd.append("arquivo", p.arquivo);
  if (p.texto) fd.append("texto", p.texto);
  if (p.instrucoes) fd.append("instrucoes", p.instrucoes);
  const { data } = await axios.post<AtaTranscricao>("/ai/transcricao", fd);
  return data;
}
