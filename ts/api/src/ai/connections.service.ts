import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiConnectionStatus, AiProvider } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from './crypto';
import { getProvider, isKnownModel } from './providers';

/** Visão pública da conexão (NUNCA inclui a chave crua). */
export interface PublicConnection {
  provider: AiProvider;
  model: string;
  keyLast4: string;
  status: AiConnectionStatus;
  validatedAt: Date | null;
}

export interface SetConnectionInput {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

@Injectable()
export class AiConnectionsService {
  private readonly logger = new Logger(AiConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Conexão atual do tenant, sem a chave. */
  async getPublic(empresaId: string): Promise<PublicConnection | null> {
    const c = await this.prisma.aiConnection.findUnique({
      where: { empresaId },
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

  /** Cria/substitui a conexão. Valida a chave antes de criptografar e salvar. */
  async upsert(
    empresaId: string,
    input: SetConnectionInput,
  ): Promise<PublicConnection> {
    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      throw new BadRequestException('Informe a chave de API.');
    }
    if (!isKnownModel(input.provider, input.model)) {
      throw new BadRequestException(
        'Modelo inválido para o provedor selecionado.',
      );
    }

    let valida: boolean;
    try {
      valida = await getProvider(input.provider).validateKey(apiKey);
    } catch (err) {
      // Erro inesperado (rede, 5xx do provedor): loga o detalhe no servidor
      // e devolve uma mensagem neutra, sem repassar o erro do SDK ao cliente.
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

    const data = {
      provider: input.provider,
      model: input.model,
      apiKeyEncrypted: this.crypto.encrypt(apiKey),
      keyLast4: apiKey.slice(-4),
      status: 'ativa' as AiConnectionStatus,
      validatedAt: new Date(),
    };

    const c = await this.prisma.aiConnection.upsert({
      where: { empresaId },
      create: { empresaId, ...data },
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

  async remove(empresaId: string): Promise<void> {
    await this.prisma.aiConnection.deleteMany({ where: { empresaId } });
  }

  /** USO INTERNO: credenciais descriptografadas para o chat. */
  async getDecrypted(
    empresaId: string,
  ): Promise<{ provider: AiProvider; model: string; apiKey: string } | null> {
    const c = await this.prisma.aiConnection.findUnique({
      where: { empresaId },
    });
    if (!c) return null;
    return {
      provider: c.provider,
      model: c.model,
      apiKey: this.crypto.decrypt(c.apiKeyEncrypted),
    };
  }
}
