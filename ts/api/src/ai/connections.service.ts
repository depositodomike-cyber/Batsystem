import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AiConnectionStatus, AiProvider } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from './crypto';
import { AiCredentialsService } from './credentials.service';
import { isKnownModelFor, isLlmProvider } from './catalogo';

/** Visão pública de um modelo na fila de texto (NUNCA inclui a chave crua). */
export interface PublicConnection {
  id: string;
  credentialId: string;
  provider: string;
  nome: string | null;
  model: string;
  keyLast4: string;
  status: AiConnectionStatus;
  /** Posição na fila de prioridade (0 = principal). */
  priority: number;
}

export interface SetConnectionInput {
  credentialId: string;
  model: string;
}

/** Credenciais prontas para uso, já descriptografadas. */
export interface DecryptedConnection {
  id: string;
  credentialId: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
}

/**
 * Fila de modelos de texto/LLM do tenant. Cada item aponta para uma
 * AiCredential; `priority` define a ordem de tentativa.
 */
@Injectable()
export class AiConnectionsService {
  private readonly logger = new Logger(AiConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly credentials: AiCredentialsService,
  ) {}

  /** Modelos do tenant em ordem de prioridade, sem as chaves. */
  async listPublic(empresaId: string): Promise<PublicConnection[]> {
    const rows = await this.prisma.aiConnection.findMany({
      where: { empresaId },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      include: { credential: true },
    });
    return rows.map((c) => this.toPublic(c));
  }

  /** Modelo principal (menor prioridade), sem a chave. */
  async getPublic(empresaId: string): Promise<PublicConnection | null> {
    const [primeira] = await this.listPublic(empresaId);
    return primeira ?? null;
  }

  /**
   * Adiciona um modelo à fila a partir de uma chave já cadastrada. Se o par
   * credencial+modelo já estiver na lista, devolve o item existente.
   */
  async upsert(
    empresaId: string,
    input: SetConnectionInput,
  ): Promise<PublicConnection> {
    const cred = await this.credentials.exigirDaEmpresa(
      empresaId,
      input.credentialId,
      'text',
    );
    if (!isKnownModelFor(cred.provider, 'text', input.model)) {
      throw new BadRequestException(
        'Modelo inválido para o provedor selecionado.',
      );
    }

    const existente = await this.prisma.aiConnection.findUnique({
      where: {
        empresaId_credentialId_model: {
          empresaId,
          credentialId: cred.id,
          model: input.model,
        },
      },
      include: { credential: true },
    });
    if (existente) return this.toPublic(existente);

    const c = await this.prisma.aiConnection.create({
      data: {
        empresaId,
        credentialId: cred.id,
        model: input.model,
        priority: await this.proximaPrioridade(empresaId),
      },
      include: { credential: true },
    });
    return this.toPublic(c);
  }

  /** Remove um modelo da fila e reindexa as posições restantes. */
  async remove(empresaId: string, id: string): Promise<void> {
    const { count } = await this.prisma.aiConnection.deleteMany({
      where: { id, empresaId },
    });
    if (count > 0) await this.reindexar(empresaId);
  }

  /** Grava a nova ordem de prioridade. */
  async reorder(empresaId: string, ids: string[]): Promise<PublicConnection[]> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.aiConnection.updateMany({
          where: { id, empresaId },
          data: { priority: index },
        }),
      ),
    );
    return this.listPublic(empresaId);
  }

  /**
   * USO INTERNO: candidatos do failover, em ordem de prioridade, com as chaves
   * descriptografadas. Só entram provedores LLM (anthropic/openai).
   */
  async listDecrypted(empresaId: string): Promise<DecryptedConnection[]> {
    const rows = await this.prisma.aiConnection.findMany({
      where: { empresaId },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      include: { credential: true },
    });
    const out: DecryptedConnection[] = [];
    for (const c of rows) {
      if (!isLlmProvider(c.credential.provider)) continue;
      try {
        out.push({
          id: c.id,
          credentialId: c.credentialId,
          provider: c.credential.provider,
          model: c.model,
          apiKey: this.crypto.decrypt(c.credential.apiKeyEncrypted),
        });
      } catch {
        this.logger.warn(
          `Chave da conexão ${c.id} (${c.credential.provider}/${c.model}) não pôde ser descriptografada; ignorada.`,
        );
      }
    }
    return out;
  }

  /** USO INTERNO: credenciais da conexão principal (ou null). */
  async getDecrypted(empresaId: string): Promise<DecryptedConnection | null> {
    const [primeira] = await this.listDecrypted(empresaId);
    return primeira ?? null;
  }

  /** Marca a chave da conexão como inválida (401/403 do provedor). */
  async marcarInvalida(id: string): Promise<void> {
    const row = await this.prisma.aiConnection.findUnique({
      where: { id },
      select: { credentialId: true },
    });
    if (row) await this.credentials.marcarInvalida(row.credentialId);
  }

  private toPublic(c: {
    id: string;
    credentialId: string;
    model: string;
    priority: number;
    credential: {
      provider: string;
      nome: string | null;
      keyLast4: string;
      status: AiConnectionStatus;
    };
  }): PublicConnection {
    return {
      id: c.id,
      credentialId: c.credentialId,
      provider: c.credential.provider,
      nome: c.credential.nome,
      model: c.model,
      keyLast4: c.credential.keyLast4,
      status: c.credential.status,
      priority: c.priority,
    };
  }

  private async proximaPrioridade(empresaId: string): Promise<number> {
    const maior = await this.prisma.aiConnection.aggregate({
      where: { empresaId },
      _max: { priority: true },
    });
    const atual = maior._max.priority;
    return atual === null ? 0 : atual + 1;
  }

  private async reindexar(empresaId: string): Promise<void> {
    const rows = await this.prisma.aiConnection.findMany({
      where: { empresaId },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true },
    });
    await this.prisma.$transaction(
      rows.map((r, index) =>
        this.prisma.aiConnection.update({
          where: { id: r.id },
          data: { priority: index },
        }),
      ),
    );
  }
}
