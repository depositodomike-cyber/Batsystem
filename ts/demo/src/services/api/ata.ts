import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar Ata (IA) — chama o backend ts/api (POST /ai/ata, multipart). A partir de
// um arquivo ou texto colado, a IA redige a ata executiva. Portado do beculture/Confi.

export interface Ata {
  titulo: string;
  ata: string;
  memoria: boolean;
}

export interface AtaParams {
  arquivo?: File | null;
  texto?: string;
  instrucoes?: string;
  memoria?: boolean;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function gerarAtaApi(p: AtaParams): Promise<Ata> {
  const fd = new FormData();
  if (p.arquivo) fd.append("arquivo", p.arquivo);
  if (p.texto) fd.append("texto", p.texto);
  if (p.instrucoes) fd.append("instrucoes", p.instrucoes);
  fd.append("memoria", p.memoria ? "true" : "false");
  if (p.design) fd.append("design", JSON.stringify(p.design));
  const { data } = await axios.post<Ata>("/ai/ata", fd);
  return data;
}
