import type { AiMediaKind } from '@prisma/client';
import { PROVIDER_CATALOG } from './providers';

/** Modalidade em que um modelo do catálogo pode ser usado. */
export type AiModality = 'text' | 'image' | 'video';

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

export interface MediaModelInfo {
  id: string;
  name: string;
}

export interface MediaProviderInfo {
  id: string;
  name: string;
  models: MediaModelInfo[];
}

/** Catálogo de provedores de mídia por modalidade. */
export const MEDIA_CATALOG: Record<AiMediaKind, MediaProviderInfo[]> = {
  image: [
    {
      id: 'openai',
      name: 'OpenAI (GPT Image / DALL·E)',
      models: [
        { id: 'gpt-image-1', name: 'GPT Image 1' },
        { id: 'dall-e-3', name: 'DALL·E 3' },
      ],
    },
    {
      id: 'stability',
      name: 'Stability AI (Stable Diffusion)',
      models: [
        { id: 'stable-image-ultra', name: 'Stable Image Ultra' },
        { id: 'stable-image-core', name: 'Stable Image Core' },
        { id: 'sd3.5-large', name: 'Stable Diffusion 3.5 Large' },
      ],
    },
    {
      id: 'black-forest-labs',
      name: 'Black Forest Labs (FLUX)',
      models: [
        { id: 'flux-1.1-pro', name: 'FLUX 1.1 Pro' },
        { id: 'flux-1-dev', name: 'FLUX.1 [dev]' },
      ],
    },
    {
      id: 'google',
      name: 'Google (Imagen)',
      models: [
        { id: 'imagen-4.0', name: 'Imagen 4' },
        { id: 'imagen-3.0', name: 'Imagen 3' },
      ],
    },
  ],
  video: [
    {
      id: 'runway',
      name: 'Runway',
      models: [
        { id: 'gen-4-turbo', name: 'Gen-4 Turbo' },
        { id: 'gen-3-alpha', name: 'Gen-3 Alpha' },
      ],
    },
    {
      id: 'luma',
      name: 'Luma (Dream Machine)',
      models: [
        { id: 'ray-2', name: 'Ray 2' },
        { id: 'ray-1.6', name: 'Ray 1.6' },
      ],
    },
    {
      id: 'pika',
      name: 'Pika',
      models: [{ id: 'pika-2.1', name: 'Pika 2.1' }],
    },
    {
      id: 'google',
      name: 'Google (Veo)',
      models: [
        { id: 'veo-3', name: 'Veo 3' },
        { id: 'veo-2', name: 'Veo 2' },
      ],
    },
    {
      id: 'kling',
      name: 'Kling AI',
      models: [
        { id: 'kling-2.0', name: 'Kling 2.0' },
        { id: 'kling-1.6', name: 'Kling 1.6' },
      ],
    },
    {
      id: 'heygen',
      name: 'HeyGen (Avatares)',
      models: [
        { id: 'avatar-iv', name: 'Avatar IV' },
        { id: 'avatar-v2', name: 'Avatar V2' },
      ],
    },
  ],
};

/** Nome curto quando o mesmo provedor aparece em mais de uma modalidade. */
const NOME_UNIFICADO: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

function montarCatalogoUnificado(): CatalogProvider[] {
  const byId = new Map<string, CatalogProvider>();

  const upsert = (
    id: string,
    name: string,
    modality: AiModality,
    models: { id: string; name: string }[],
  ) => {
    const atual = byId.get(id);
    const display = NOME_UNIFICADO[id] ?? name;
    if (!atual) {
      byId.set(id, {
        id,
        name: display,
        modalities: [modality],
        models: models.map((m) => ({ ...m, modality })),
      });
      return;
    }
    if (!atual.modalities.includes(modality)) atual.modalities.push(modality);
    for (const m of models) {
      if (!atual.models.some((x) => x.id === m.id && x.modality === modality)) {
        atual.models.push({ ...m, modality });
      }
    }
  };

  for (const p of PROVIDER_CATALOG) {
    upsert(p.id, p.name, 'text', p.models);
  }
  for (const p of MEDIA_CATALOG.image) {
    upsert(p.id, p.name, 'image', p.models);
  }
  for (const p of MEDIA_CATALOG.video) {
    upsert(p.id, p.name, 'video', p.models);
  }

  return [...byId.values()];
}

/** Catálogo unificado (texto + imagem + vídeo) exposto em GET /ai/providers. */
export const UNIFIED_CATALOG: CatalogProvider[] = montarCatalogoUnificado();

export function isKnownProvider(provider: string): boolean {
  return UNIFIED_CATALOG.some((p) => p.id === provider);
}

/** Anthropic e OpenAI têm validateKey no SDK; os demais só checam formato. */
export function isLlmProvider(
  provider: string,
): provider is 'anthropic' | 'openai' {
  return provider === 'anthropic' || provider === 'openai';
}

export function providerName(provider: string): string {
  return UNIFIED_CATALOG.find((p) => p.id === provider)?.name ?? provider;
}

export function modelsOf(
  provider: string,
  modality: AiModality,
): { id: string; name: string }[] {
  const p = UNIFIED_CATALOG.find((x) => x.id === provider);
  if (!p) return [];
  return p.models
    .filter((m) => m.modality === modality)
    .map(({ id, name }) => ({ id, name }));
}

export function isKnownModelFor(
  provider: string,
  modality: AiModality,
  model: string,
): boolean {
  return modelsOf(provider, modality).some((m) => m.id === model);
}

export function providerServes(
  provider: string,
  modality: AiModality,
): boolean {
  const p = UNIFIED_CATALOG.find((x) => x.id === provider);
  return !!p && p.modalities.includes(modality);
}

export function catalogForKind(kind: AiMediaKind): MediaProviderInfo[] {
  return MEDIA_CATALOG[kind];
}
