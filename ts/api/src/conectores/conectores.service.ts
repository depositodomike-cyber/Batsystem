import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/ai/crypto';
import {
  Connector,
  ConnectorCategory,
  connectorCategories,
  connectors,
  getConnector,
} from './catalog';
import { camposDoConector, exigeCredenciais } from './credenciais-spec';

/**
 * Teto por campo. Nenhuma credencial de provedor chega perto disso — o maior
 * caso real são tokens permanentes da Meta, na casa das centenas de caracteres —
 * então o limite existe para barrar payload absurdo, não para apertar o usuário.
 */
const MAX_TAMANHO_CAMPO = 4096;

/** Credenciais de formulário: só os NOMES dos campos preenchidos. */
export interface CredenciaisResumo {
  campos: string[];
  atualizadoEm: Date | null;
}

/** Conector do catálogo + estado de conexão do tenant. */
export interface ConnectorWithStatus extends Connector {
  connected: boolean;
  connectedAt: Date | null;
  /** Conta/workspace autorizada via OAuth (ex.: nome do time Slack). */
  workspace: string | null;
  /** True quando há credenciais OAuth reais (não só o toggle de estado). */
  hasCredentials: boolean;
  /**
   * Credenciais informadas por formulário, quando houver — apenas os nomes dos
   * campos, nunca os valores. `null` em conector que não usa formulário ou que
   * ainda não recebeu credenciais.
   */
  credenciais: CredenciaisResumo | null;
}

/**
 * Estado dos conectores por empresa. O catálogo é estático (catalog.ts);
 * aqui só gerenciamos quais conectores cada tenant ativou. Usado tanto
 * pelo REST do app quanto pelas ferramentas do servidor MCP.
 */
@Injectable()
export class ConectoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

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
      credenciais: this.resumoCredenciais(byConnector.get(c.id)),
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
      credenciais: this.resumoCredenciais(vinculo),
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

  /**
   * Grava as credenciais de formulário e ativa o conector.
   *
   * Substitui o conjunto inteiro (não faz merge): o formulário sempre envia
   * todos os campos, e merge silencioso deixaria valor antigo de um campo que o
   * usuário apagou de propósito.
   */
  async salvarCredenciais(
    empresaId: string,
    connectorId: string,
    campos: Record<string, string>,
  ): Promise<ConnectorWithStatus> {
    this.requireFromCatalog(connectorId);

    if (!exigeCredenciais(connectorId)) {
      throw new BadRequestException(
        `O conector "${connectorId}" não se conecta por credenciais.`,
      );
    }

    const spec = camposDoConector(connectorId);
    const permitidos = new Set(spec.map((c) => c.id));

    // Campo fora da spec é erro, e não algo a ignorar: quase sempre significa
    // front e backend divergindo, e aceitar em silêncio guardaria credencial no
    // lugar errado. Mesma postura do `forbidNonWhitelisted` do ValidationPipe.
    const desconhecidos = Object.keys(campos).filter((k) => !permitidos.has(k));
    if (desconhecidos.length > 0) {
      throw new BadRequestException(
        `Campos não reconhecidos para "${connectorId}": ${desconhecidos.join(', ')}.`,
      );
    }

    // Valor precisa ser string: o DTO garante só que `campos` é objeto, então
    // um número ou objeto aninhado chegaria até aqui e viraria "[object Object]"
    // depois do JSON.stringify.
    const naoTexto = Object.entries(campos)
      .filter(([, v]) => typeof v !== 'string')
      .map(([k]) => k);
    if (naoTexto.length > 0) {
      throw new BadRequestException(
        `Valores devem ser texto: ${naoTexto.join(', ')}.`,
      );
    }

    const longos = Object.entries(campos)
      .filter(([, v]) => (v as string).length > MAX_TAMANHO_CAMPO)
      .map(([k]) => k);
    if (longos.length > 0) {
      throw new BadRequestException(
        `Valores acima de ${MAX_TAMANHO_CAMPO} caracteres: ${longos.join(', ')}.`,
      );
    }

    // Só o que veio preenchido é guardado — campo opcional em branco não vira
    // string vazia no JSON.
    const limpos: Record<string, string> = {};
    for (const [id, valor] of Object.entries(campos)) {
      const v = valor.trim();
      if (v !== '') limpos[id] = v;
    }

    const faltando = spec
      .filter((c) => c.obrigatorio && !limpos[c.id])
      .map((c) => c.id);
    if (faltando.length > 0) {
      throw new BadRequestException(
        `Campos obrigatórios ausentes: ${faltando.join(', ')}.`,
      );
    }

    const credenciaisEncrypted = this.crypto.encrypt(JSON.stringify(limpos));
    await this.prisma.empresaConector.upsert({
      where: { empresaId_connectorId: { empresaId, connectorId } },
      create: {
        empresaId,
        connectorId,
        origem: 'app',
        credenciaisEncrypted,
        credenciaisAtualizadoEm: new Date(),
      },
      update: {
        credenciaisEncrypted,
        credenciaisAtualizadoEm: new Date(),
      },
    });
    return this.get(empresaId, connectorId);
  }

  /**
   * Nomes dos campos preenchidos, decifrando o JSON guardado.
   *
   * Nunca devolve valor. Se a decifragem falhar (ENCRYPTION_KEY trocada), trata
   * como ausente em vez de derrubar a listagem inteira dos conectores.
   */
  private resumoCredenciais(
    vinculo?: {
      credenciaisEncrypted: string | null;
      credenciaisAtualizadoEm: Date | null;
    } | null,
  ): CredenciaisResumo | null {
    if (!vinculo?.credenciaisEncrypted) return null;
    try {
      const dados = JSON.parse(
        this.crypto.decrypt(vinculo.credenciaisEncrypted),
      ) as Record<string, unknown>;
      return {
        campos: Object.keys(dados),
        atualizadoEm: vinculo.credenciaisAtualizadoEm,
      };
    } catch {
      return null;
    }
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
