import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Connector,
  ConnectorCategory,
  connectorCategories,
  connectors,
  getConnector,
} from './catalog';

/** Conector do catálogo + estado de conexão do tenant. */
export interface ConnectorWithStatus extends Connector {
  connected: boolean;
  connectedAt: Date | null;
  /** Conta/workspace autorizada via OAuth (ex.: nome do time Slack). */
  workspace: string | null;
  /** True quando há credenciais OAuth reais (não só o toggle de estado). */
  hasCredentials: boolean;
}

/**
 * Estado dos conectores por empresa. O catálogo é estático (catalog.ts);
 * aqui só gerenciamos quais conectores cada tenant ativou. Usado tanto
 * pelo REST do app quanto pelas ferramentas do servidor MCP.
 */
@Injectable()
export class ConectoresService {
  constructor(private readonly prisma: PrismaService) {}

  categories(): ConnectorCategory[] {
    return connectorCategories;
  }

  /** Catálogo completo com o estado da empresa, opcionalmente filtrado. */
  async list(
    empresaId: string,
    filtro?: { categoria?: string; apenasConectados?: boolean },
  ): Promise<ConnectorWithStatus[]> {
    const vinculos = await this.prisma.empresaConector.findMany({
      where: { empresaId },
    });
    const byConnector = new Map(vinculos.map((v) => [v.connectorId, v]));

    let lista = connectors.map((c) => ({
      ...c,
      connected: byConnector.has(c.id),
      connectedAt: byConnector.get(c.id)?.criadoEm ?? null,
      workspace: byConnector.get(c.id)?.teamName ?? null,
      hasCredentials: Boolean(byConnector.get(c.id)?.accessTokenEncrypted),
    }));
    if (filtro?.categoria) {
      lista = lista.filter((c) => c.category === filtro.categoria);
    }
    if (filtro?.apenasConectados) {
      lista = lista.filter((c) => c.connected);
    }
    return lista.sort((a, b) => a.rank - b.rank);
  }

  async get(empresaId: string, connectorId: string): Promise<ConnectorWithStatus> {
    const conector = this.requireFromCatalog(connectorId);
    const vinculo = await this.prisma.empresaConector.findUnique({
      where: { empresaId_connectorId: { empresaId, connectorId } },
    });
    return {
      ...conector,
      connected: Boolean(vinculo),
      connectedAt: vinculo?.criadoEm ?? null,
      workspace: vinculo?.teamName ?? null,
      hasCredentials: Boolean(vinculo?.accessTokenEncrypted),
    };
  }

  /** Ativa o conector para a empresa (idempotente). */
  async connect(
    empresaId: string,
    connectorId: string,
    origem: 'app' | 'mcp',
  ): Promise<ConnectorWithStatus> {
    this.requireFromCatalog(connectorId);
    await this.prisma.empresaConector.upsert({
      where: { empresaId_connectorId: { empresaId, connectorId } },
      create: { empresaId, connectorId, origem },
      update: {},
    });
    return this.get(empresaId, connectorId);
  }

  /** Desativa o conector (idempotente). */
  async disconnect(
    empresaId: string,
    connectorId: string,
  ): Promise<ConnectorWithStatus> {
    this.requireFromCatalog(connectorId);
    await this.prisma.empresaConector.deleteMany({
      where: { empresaId, connectorId },
    });
    return this.get(empresaId, connectorId);
  }

  private requireFromCatalog(connectorId: string): Connector {
    const conector = getConnector(connectorId);
    if (!conector) {
      throw new NotFoundException(
        `Conector "${connectorId}" não existe no catálogo.`,
      );
    }
    return conector;
  }
}
