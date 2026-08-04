import axios from "@/utils/axios";
import type { DesignSystem } from "@/app/pages/ceo/design-system/types";

// Criar vídeo (IA · HeyGen) — chama o backend ts/api. Fluxo: (roteiro via IA) →
// escolher avatar/voz → gerar (nuvem HeyGen) → poll status → MP4. Portado do
// beculture/Confi (lib/heygen.js). A chave HeyGen fica no servidor.

export interface Avatar {
  id: string;
  nome: string;
  genero: string;
  preview: string;
  previewVideo: string;
  premium: boolean | null;
  tipo: string;
}
export interface Voz {
  id: string;
  nome: string;
  idioma: string;
  genero: string;
}
export interface VideoStatus {
  status: string;
  url: string;
  thumb: string;
  duracao: number;
  erro: string;
}
export interface GerarVideoReq {
  script: string;
  avatarId: string;
  voiceId: string;
  formato?: string;
  speed?: number;
  fundo?: string;
  titulo?: string;
  teste?: boolean;
  /** Design system da marca ativa (AI Studio). */
  design?: DesignSystem;
}

export async function getVideoConfig(): Promise<{ configurado: boolean }> {
  const { data } = await axios.get<{ configurado: boolean }>("/ai/video/config");
  return data;
}

export async function gerarRoteiroVideoApi(req: {
  tema: string;
  contexto?: string;
  /** Design system da marca ativa (AI Studio) — guia o tom do roteiro. */
  design?: DesignSystem;
}): Promise<string> {
  const { data } = await axios.post<{ script: string }>("/ai/video/roteiro", req);
  return data.script;
}

export async function getAvatares(): Promise<Avatar[]> {
  const { data } = await axios.get<{ avatares: Avatar[] }>("/ai/video/avatares");
  return data.avatares;
}

export async function getVozes(): Promise<Voz[]> {
  const { data } = await axios.get<{ vozes: Voz[] }>("/ai/video/vozes");
  return data.vozes;
}

export async function gerarVideoApi(req: GerarVideoReq): Promise<{ videoId: string; teste: boolean }> {
  const { data } = await axios.post<{ videoId: string; teste: boolean }>("/ai/video/gerar", req);
  return data;
}

export async function getVideoStatusApi(videoId: string): Promise<VideoStatus> {
  const { data } = await axios.get<VideoStatus>("/ai/video/status", { params: { videoId } });
  return data;
}
