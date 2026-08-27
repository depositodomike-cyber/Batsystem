import axios from "@/utils/axios";

/**
 * Chaves de API do tenant (BYOK). Uma credencial é um provedor + chave
 * (+ nome opcional). Os modelos de Texto/Imagem/Vídeo apontam para cá.
 * A chave nunca volta do servidor.
 */

export type AiModality = "text" | "image" | "video";

export interface CatalogModel {
  id: string;
  name: string;
  modality: AiModality;
}

export interface CatalogProvider {
  id: string;
  name: string;
  modalities: AiModality[];
  models: CatalogModel[];
}

export interface AiCredential {
  id: string;
  provider: string;
  nome: string | null;
  keyLast4: string;
  status: "ativa" | "invalida";
  validatedAt: string | null;
  modelCount: number;
  /**
   * Só vem na resposta do cadastro: a chave foi salva sem que o provedor
   * confirmasse que funciona (rede, cota, escopo da chave). Na listagem isso
   * aparece como `validatedAt: null`.
   */
  aviso?: string;
}

export interface CreateCredentialInput {
  provider: string;
  apiKey: string;
  nome?: string;
}

/**
 * Espelho do catálogo do servidor (`UNIFIED_CATALOG`, em
 * `ts/api/src/ai/catalogo.ts`). Lá ele é uma constante estática — não vem de
 * banco nem varia por tenant —, então o front pode conhecê-lo de antemão e
 * nunca mostrar um select de provedor vazio quando a API não responde.
 *
 * A resposta do servidor sempre prevalece; isto é só o piso. Ao mexer no
 * catálogo do servidor, atualize esta lista junto — quem escolher aqui um
 * provedor que o servidor não conhece leva um 400 "Provedor inválido" na hora
 * de salvar a chave.
 */
export const PROVEDORES_PADRAO: CatalogProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    modalities: ["text"],
    models: [
      { id: "claude-opus-5", name: "Claude Opus 5", modality: "text" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", modality: "text" },
      { id: "claude-opus-4-8", name: "Claude Opus 4.8", modality: "text" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", modality: "text" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", modality: "text" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    modalities: ["text", "image"],
    models: [
      { id: "gpt-4o", name: "GPT-4o", modality: "text" },
      { id: "gpt-4o-mini", name: "GPT-4o mini", modality: "text" },
      { id: "gpt-4.1", name: "GPT-4.1", modality: "text" },
      { id: "gpt-image-1", name: "GPT Image 1", modality: "image" },
      { id: "dall-e-3", name: "DALL·E 3", modality: "image" },
    ],
  },
  {
    id: "stability",
    name: "Stability AI (Stable Diffusion)",
    modalities: ["image"],
    models: [
      { id: "stable-image-ultra", name: "Stable Image Ultra", modality: "image" },
      { id: "stable-image-core", name: "Stable Image Core", modality: "image" },
      { id: "sd3.5-large", name: "Stable Diffusion 3.5 Large", modality: "image" },
    ],
  },
  {
    id: "black-forest-labs",
    name: "Black Forest Labs (FLUX)",
    modalities: ["image"],
    models: [
      { id: "flux-1.1-pro", name: "FLUX 1.1 Pro", modality: "image" },
      { id: "flux-1-dev", name: "FLUX.1 [dev]", modality: "image" },
    ],
  },
  {
    id: "google",
    name: "Google",
    modalities: ["image", "video"],
    models: [
      { id: "imagen-4.0", name: "Imagen 4", modality: "image" },
      { id: "imagen-3.0", name: "Imagen 3", modality: "image" },
      { id: "veo-3", name: "Veo 3", modality: "video" },
      { id: "veo-2", name: "Veo 2", modality: "video" },
    ],
  },
  {
    id: "runway",
    name: "Runway",
    modalities: ["video"],
    models: [
      { id: "gen-4-turbo", name: "Gen-4 Turbo", modality: "video" },
      { id: "gen-3-alpha", name: "Gen-3 Alpha", modality: "video" },
    ],
  },
  {
    id: "luma",
    name: "Luma (Dream Machine)",
    modalities: ["video"],
    models: [
      { id: "ray-2", name: "Ray 2", modality: "video" },
      { id: "ray-1.6", name: "Ray 1.6", modality: "video" },
    ],
  },
  {
    id: "pika",
    name: "Pika",
    modalities: ["video"],
    models: [{ id: "pika-2.1", name: "Pika 2.1", modality: "video" }],
  },
  {
    id: "kling",
    name: "Kling AI",
    modalities: ["video"],
    models: [
      { id: "kling-2.0", name: "Kling 2.0", modality: "video" },
      { id: "kling-1.6", name: "Kling 1.6", modality: "video" },
    ],
  },
  {
    id: "heygen",
    name: "HeyGen (Avatares)",
    modalities: ["video"],
    models: [
      { id: "avatar-iv", name: "Avatar IV", modality: "video" },
      { id: "avatar-v2", name: "Avatar V2", modality: "video" },
    ],
  },
];

/**
 * Catálogo unificado (texto + imagem + vídeo). Cai no espelho local se a API
 * não responder, para o select de provedor nunca ficar vazio.
 */
export async function getAiProviders(): Promise<CatalogProvider[]> {
  try {
    const { data } = await axios.get<CatalogProvider[]>("/ai/providers");
    return data?.length ? data : PROVEDORES_PADRAO;
  } catch {
    return PROVEDORES_PADRAO;
  }
}

export async function listAiCredentials(): Promise<AiCredential[]> {
  const { data } = await axios.get<AiCredential[]>("/ai/credentials");
  return data ?? [];
}

export async function createAiCredential(
  input: CreateCredentialInput,
): Promise<AiCredential> {
  const { data } = await axios.post<AiCredential>("/ai/credentials", input);
  return data;
}

export async function removeAiCredential(id: string): Promise<void> {
  await axios.delete(`/ai/credentials/${id}`);
}
