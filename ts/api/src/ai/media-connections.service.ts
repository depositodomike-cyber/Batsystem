import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiConnectionStatus, AiMediaKind } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from './crypto';

/**
 * Conexões de IA de mídia (Imagem e Vídeo), por modalidade e por tenant.
 * Separadas da AiConnection (texto/LLM): a de `image` é usada SÓ em
 * "Criar Imagem" e a de `video` SÓ em "Criar Vídeo". A chave é validada
 * apenas por formato (provedores de mídia não têm um `validateKey` uniforme
 * como os LLMs) e criptografada em repouso.
 */

export interface MediaModelInfo {
  id: string;
  name: string;
}
export interface MediaProviderInfo {
  id: string;
  name: string;
  models: MediaModelInfo[];
}

/** Catálogo de provedores por modalidade (espelha o front). */
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

function isKnownMediaModel(
  kind: AiMediaKind,
  provider: string,
  model: string,
): boolean {
  const p = MEDIA_CATALOG[kind].find((x) => x.id === provider);
  return !!p && p.models.some((m) => m.id === model);
}

/** Visão pública da conexão (NUNCA inclui a chave crua). */
export interface PublicMediaConnection {
  provider: string;
  model: string;
  keyLast4: string;
  status: AiConnectionStatus;
  validatedAt: Date | null;
}

export interface SetMediaConnectionInput {
  provider: string;
  model: string;
  apiKey: string;
}

@Injectable()
export class AiMediaConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  catalog(kind: AiMediaKind): MediaProviderInfo[] {
    return MEDIA_CATALOG[kind];
  }

  async getPublic(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<PublicMediaConnection | null> {
    const c = await this.prisma.aiMediaConnection.findUnique({
      where: { empresaId_kind: { empresaId, kind } },
    });
    if (!c) return null;
    return {
      provider: c.provider,
      model: c.model,
      keyLast4: c.keyLast4,
      status: c.status,
      validatedAt: c.validatedAt,
    };
  }

  async upsert(
    empresaId: string,
    kind: AiMediaKind,
    input: SetMediaConnectionInput,
  ): Promise<PublicMediaConnection> {
    const apiKey = input.apiKey.trim();
    if (!apiKey) throw new BadRequestException('Informe a chave de API.');
    if (!isKnownMediaModel(kind, input.provider, input.model)) {
      throw new BadRequestException(
        'Provedor ou modelo inválido para esta modalidade.',
      );
    }

    const data = {
      provider: input.provider,
      model: input.model,
      apiKeyEncrypted: this.crypto.encrypt(apiKey),
      keyLast4: apiKey.slice(-4),
      status: 'ativa' as AiConnectionStatus,
      validatedAt: new Date(),
    };

    const c = await this.prisma.aiMediaConnection.upsert({
      where: { empresaId_kind: { empresaId, kind } },
      create: { empresaId, kind, ...data },
      update: data,
    });

    return {
      provider: c.provider,
      model: c.model,
      keyLast4: c.keyLast4,
      status: c.status,
      validatedAt: c.validatedAt,
    };
  }

  async remove(empresaId: string, kind: AiMediaKind): Promise<void> {
    await this.prisma.aiMediaConnection.deleteMany({
      where: { empresaId, kind },
    });
  }

  /** USO INTERNO: chave descriptografada da modalidade (ou null). */
  async getDecrypted(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<{ provider: string; model: string; apiKey: string } | null> {
    const c = await this.prisma.aiMediaConnection.findUnique({
      where: { empresaId_kind: { empresaId, kind } },
    });
    if (!c) return null;
    return {
      provider: c.provider,
      model: c.model,
      apiKey: this.crypto.decrypt(c.apiKeyEncrypted),
    };
  }
}
