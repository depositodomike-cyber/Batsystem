import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar imagem (IA) — chama o backend ts/api (POST /ai/imagem), que usa a
// OpenAI (gpt-image-1 / DALL·E). Portado do beculture/Confi. As imagens voltam
// como data URLs base64.

export type ModeloImagem = "gpt-image-1" | "dall-e-3" | "dall-e-2";

export interface ImagemReq {
  prompt: string;
  modelo: ModeloImagem;
  size?: string;
  quality?: string;
  style?: string;
  background?: string;
  formato?: string;
  n?: number;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export interface ImagemResult {
  images: string[]; // data URLs
  formato: string;
}

export async function gerarImagemApi(req: ImagemReq): Promise<ImagemResult> {
  const { data } = await axios.post<ImagemResult>("/ai/imagem", req);
  return data;
}
