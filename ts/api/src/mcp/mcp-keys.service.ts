import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';

/** Visão pública da chave (NUNCA inclui a chave crua nem o hash). */
export interface PublicMcpKey {
  id: string;
  nome: string;
  last4: string;
  criadoEm: Date;
  lastUsedAt: Date | null;
}

/** Retorno da criação: única vez em que a chave crua é exposta. */
export interface CreatedMcpKey extends PublicMcpKey {
  key: string;
}

const KEY_PREFIX = 'bcl_mcp_';

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * API keys do servidor MCP, por empresa. A chave tem alta entropia
 * (24 bytes aleatórios), então o lookup por SHA-256 sem salt é seguro.
 */
@Injectable()
export class McpKeysService {
  private readonly logger = new Logger(McpKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: string, nome: string): Promise<CreatedMcpKey> {
    const key = KEY_PREFIX + randomBytes(24).toString('base64url');
    const created = await this.prisma.mcpApiKey.create({
      data: {
        empresaId,
        nome,
        keyHash: hashKey(key),
        last4: key.slice(-4),
      },
    });
    return {
      id: created.id,
      nome: created.nome,
      last4: created.last4,
      criadoEm: created.criadoEm,
      lastUsedAt: created.lastUsedAt,
      key,
    };
  }

  async list(empresaId: string): Promise<PublicMcpKey[]> {
    const keys = await this.prisma.mcpApiKey.findMany({
      where: { empresaId, revogadaEm: null },
      orderBy: { criadoEm: 'desc' },
    });
    return keys.map((k) => ({
      id: k.id,
      nome: k.nome,
      last4: k.last4,
      criadoEm: k.criadoEm,
      lastUsedAt: k.lastUsedAt,
    }));
  }

  async revoke(empresaId: string, id: string): Promise<void> {
    const { count } = await this.prisma.mcpApiKey.updateMany({
      where: { id, empresaId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Chave não encontrada.');
    }
  }

  /**
   * Autentica uma chave crua vinda de um cliente MCP.
   * Retorna o tenant dono da chave, ou null se inválida/revogada.
   */
  async resolve(rawKey: string): Promise<{ empresaId: string } | null> {
    if (!rawKey.startsWith(KEY_PREFIX)) return null;
    const keyHash = hashKey(rawKey);
    const found = await this.prisma.mcpApiKey.findUnique({
      where: { keyHash },
    });
    if (!found || found.revogadaEm) return null;
    // Reconfere em tempo constante (lookup por hash já é resistente, mas
    // mantém a comparação final fora do índice do banco).
    const a = Buffer.from(keyHash);
    const b = Buffer.from(found.keyHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // Carimbo de último uso é melhor-esforço: não atrasa o request.
    this.prisma.mcpApiKey
      .update({ where: { id: found.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => this.logger.warn(`lastUsedAt: ${err}`));

    return { empresaId: found.empresaId };
  }
}
