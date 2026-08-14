import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiConnectionStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from './crypto';
import {
  isKnownProvider,
  isLlmProvider,
  providerServes,
  type AiModality,
} from './catalogo';
import { getProvider } from './providers';

/** Visão pública da chave (NUNCA inclui a chave crua). */
export interface PublicCredential {
  id: string;
  provider: string;
  nome: string | null;
  keyLast4: string;
  status: AiConnectionStatus;
  validatedAt: Date | null;
  /** Quantos modelos (texto + imagem + vídeo) usam esta chave. */
  modelCount: number;
}

export interface CreateCredentialInput {
  provider: string;
  apiKey: string;
  nome?: string;
}

/**
 * Chaves de API do tenant (BYOK). Uma credencial é um provedor + chave (+ nome
 * opcional). Os modelos de cada modalidade apontam para cá; apagar a credencial
 * remove os modelos das filas.
 */
@Injectable()
export class AiCredentialsService {
  private readonly logger = new Logger(AiCredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listPublic(empresaId: string): Promise<PublicCredential[]> {
    const rows = await this.prisma.aiCredential.findMany({
      where: { empresaId },
      orderBy: [{ criadoEm: 'asc' }],
      include: {
        _count: { select: { textModels: true, mediaModels: true } },
      },
    });
    return rows.map((c) => this.toPublic(c));
  }

  /**
   * Credenciais cujo provedor oferece modelos da modalidade — usadas no select
   * "Conexão" do painel de configurar modelos.
   */
  async listForModality(
    empresaId: string,
    modality: AiModality,
  ): Promise<PublicCredential[]> {
    const todas = await this.listPublic(empresaId);
    return todas.filter((c) => providerServes(c.provider, modality));
  }

  async create(
    empresaId: string,
    input: CreateCredentialInput,
  ): Promise<PublicCredential> {
    const provider = input.provider.trim();
    if (!isKnownProvider(provider)) {
      throw new BadRequestException('Provedor inválido.');
    }
    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      throw new BadRequestException('Informe a chave de API.');
    }
    const nome = input.nome?.trim() || null;

    if (isLlmProvider(provider)) {
      let valida: boolean;
      try {
        valida = await getProvider(provider).validateKey(apiKey);
      } catch (err) {
        this.logger.error(err);
        throw new ServiceUnavailableException(
          'Não foi possível validar a chave junto ao provedor. Tente novamente.',
        );
      }
      if (!valida) {
        throw new BadRequestException(
          'Chave de API inválida para o provedor selecionado.',
        );
      }
    }

    const c = await this.prisma.aiCredential.create({
      data: {
        empresaId,
        provider,
        nome,
        apiKeyEncrypted: this.crypto.encrypt(apiKey),
        keyLast4: apiKey.slice(-4),
        status: 'ativa',
        validatedAt: new Date(),
      },
      include: {
        _count: { select: { textModels: true, mediaModels: true } },
      },
    });
    return this.toPublic(c);
  }

  /** Remove a chave e, em cascata, os modelos das três filas. */
  async remove(empresaId: string, id: string): Promise<void> {
    const { count } = await this.prisma.aiCredential.deleteMany({
      where: { id, empresaId },
    });
    if (count === 0) {
      throw new NotFoundException('Chave não encontrada.');
    }
    await this.reindexarFilas(empresaId);
  }

  /** Marca a credencial como inválida quando o provedor rejeita a chave. */
  async marcarInvalida(id: string): Promise<void> {
    await this.prisma.aiCredential
      .update({ where: { id }, data: { status: 'invalida' } })
      .catch(() => undefined);
  }

  /**
   * Confere se a credencial é da empresa e serve a modalidade. Usado ao
   * adicionar um modelo na fila.
   */
  async exigirDaEmpresa(
    empresaId: string,
    id: string,
    modality: AiModality,
  ): Promise<{ id: string; provider: string }> {
    const c = await this.prisma.aiCredential.findFirst({
      where: { id, empresaId },
      select: { id: true, provider: true },
    });
    if (!c) {
      throw new BadRequestException('Conexão de IA não encontrada.');
    }
    if (!providerServes(c.provider, modality)) {
      throw new BadRequestException(
        'Esta chave não oferece modelos para esta modalidade.',
      );
    }
    return c;
  }

  private toPublic(c: {
    id: string;
    provider: string;
    nome: string | null;
    keyLast4: string;
    status: AiConnectionStatus;
    validatedAt: Date | null;
    _count: { textModels: number; mediaModels: number };
  }): PublicCredential {
    return {
      id: c.id,
      provider: c.provider,
      nome: c.nome,
      keyLast4: c.keyLast4,
      status: c.status,
      validatedAt: c.validatedAt,
      modelCount: c._count.textModels + c._count.mediaModels,
    };
  }

  /** Depois de apagar uma chave, as filas podem ter buracos na prioridade. */
  private async reindexarFilas(empresaId: string): Promise<void> {
    const texto = await this.prisma.aiConnection.findMany({
      where: { empresaId },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true },
    });
    const imagem = await this.prisma.aiMediaConnection.findMany({
      where: { empresaId, kind: 'image' },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true },
    });
    const video = await this.prisma.aiMediaConnection.findMany({
      where: { empresaId, kind: 'video' },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true },
    });
    await this.prisma.$transaction([
      ...texto.map((r, index) =>
        this.prisma.aiConnection.update({
          where: { id: r.id },
          data: { priority: index },
        }),
      ),
      ...imagem.map((r, index) =>
        this.prisma.aiMediaConnection.update({
          where: { id: r.id },
          data: { priority: index },
        }),
      ),
      ...video.map((r, index) =>
        this.prisma.aiMediaConnection.update({
          where: { id: r.id },
          data: { priority: index },
        }),
      ),
    ]);
  }
}
