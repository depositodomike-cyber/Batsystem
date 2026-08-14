import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AiConnectionStatus, AiMediaKind } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from './crypto';
import { AiCredentialsService } from './credentials.service';
import {
  catalogForKind,
  isKnownModelFor,
  type MediaProviderInfo,
} from './catalogo';

/**
 * Fila de modelos de mídia (Imagem e Vídeo). A chave fica em AiCredential;
 * aqui só o modelo, a modalidade e a ordem de prioridade.
 */

/** Visão pública de um modelo na fila (NUNCA inclui a chave crua). */
export interface PublicMediaConnection {
  id: string;
  credentialId: string;
  provider: string;
  nome: string | null;
  model: string;
  keyLast4: string;
  status: AiConnectionStatus;
  /** Posição na fila de prioridade da modalidade (0 = principal). */
  priority: number;
}

export interface SetMediaConnectionInput {
  credentialId: string;
  model: string;
}

/** Credenciais prontas para uso, já descriptografadas. */
export interface DecryptedMediaConnection {
  id: string;
  credentialId: string;
  provider: string;
  model: string;
  apiKey: string;
}

@Injectable()
export class AiMediaConnectionsService {
  private readonly logger = new Logger(AiMediaConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly credentials: AiCredentialsService,
  ) {}

  catalog(kind: AiMediaKind): MediaProviderInfo[] {
    return catalogForKind(kind);
  }

  /** Modelos da modalidade em ordem de prioridade, sem as chaves. */
  async listPublic(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<PublicMediaConnection[]> {
    const rows = await this.prisma.aiMediaConnection.findMany({
      where: { empresaId, kind },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      include: { credential: true },
    });
    return rows.map((c) => this.toPublic(c));
  }

  async getPublic(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<PublicMediaConnection | null> {
    const [primeira] = await this.listPublic(empresaId, kind);
    return primeira ?? null;
  }

  /**
   * Adiciona um modelo à fila a partir de uma chave já cadastrada. Se o par
   * credencial+modelo já estiver na lista, devolve o item existente.
   */
  async upsert(
    empresaId: string,
    kind: AiMediaKind,
    input: SetMediaConnectionInput,
  ): Promise<PublicMediaConnection> {
    const cred = await this.credentials.exigirDaEmpresa(
      empresaId,
      input.credentialId,
      kind,
    );
    if (!isKnownModelFor(cred.provider, kind, input.model)) {
      throw new BadRequestException(
        'Provedor ou modelo inválido para esta modalidade.',
      );
    }

    const existente = await this.prisma.aiMediaConnection.findUnique({
      where: {
        empresaId_kind_credentialId_model: {
          empresaId,
          kind,
          credentialId: cred.id,
          model: input.model,
        },
      },
      include: { credential: true },
    });
    if (existente) return this.toPublic(existente);

    const c = await this.prisma.aiMediaConnection.create({
      data: {
        empresaId,
        kind,
        credentialId: cred.id,
        model: input.model,
        priority: await this.proximaPrioridade(empresaId, kind),
      },
      include: { credential: true },
    });
    return this.toPublic(c);
  }

  async remove(
    empresaId: string,
    kind: AiMediaKind,
    id: string,
  ): Promise<void> {
    const { count } = await this.prisma.aiMediaConnection.deleteMany({
      where: { id, empresaId, kind },
    });
    if (count > 0) await this.reindexar(empresaId, kind);
  }

  async reorder(
    empresaId: string,
    kind: AiMediaKind,
    ids: string[],
  ): Promise<PublicMediaConnection[]> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.aiMediaConnection.updateMany({
          where: { id, empresaId, kind },
          data: { priority: index },
        }),
      ),
    );
    return this.listPublic(empresaId, kind);
  }

  async listDecrypted(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<DecryptedMediaConnection[]> {
    const rows = await this.prisma.aiMediaConnection.findMany({
      where: { empresaId, kind },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      include: { credential: true },
    });
    const out: DecryptedMediaConnection[] = [];
    for (const c of rows) {
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
          `Chave da conexão de ${kind} ${c.id} (${c.credential.provider}/${c.model}) não pôde ser descriptografada; ignorada.`,
        );
      }
    }
    return out;
  }

  async getDecrypted(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<DecryptedMediaConnection | null> {
    const [primeira] = await this.listDecrypted(empresaId, kind);
    return primeira ?? null;
  }

  async marcarInvalida(id: string): Promise<void> {
    const row = await this.prisma.aiMediaConnection.findUnique({
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
  }): PublicMediaConnection {
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

  private async proximaPrioridade(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<number> {
    const maior = await this.prisma.aiMediaConnection.aggregate({
      where: { empresaId, kind },
      _max: { priority: true },
    });
    const atual = maior._max.priority;
    return atual === null ? 0 : atual + 1;
  }

  private async reindexar(
    empresaId: string,
    kind: AiMediaKind,
  ): Promise<void> {
    const rows = await this.prisma.aiMediaConnection.findMany({
      where: { empresaId, kind },
      orderBy: [{ priority: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true },
    });
    await this.prisma.$transaction(
      rows.map((r, index) =>
        this.prisma.aiMediaConnection.update({
          where: { id: r.id },
          data: { priority: index },
        }),
      ),
    );
  }
}
