import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** Validade do `state` anti-CSRF: o usuário tem 10 min para autorizar. */
const STATE_TTL_MS = 10 * 60 * 1000;

export interface OauthState {
  empresaId: string;
  connectorId: string;
}

/**
 * `state` anti-CSRF dos fluxos OAuth, assinado (HMAC) e sem sessão no
 * servidor: o próprio parâmetro carrega a empresa e o conector, então o
 * callback — que chega sem JWT, direto do navegador — sabe a quem pertence
 * a autorização. Compartilhado por todos os conectores OAuth (Slack, e-mail).
 */
@Injectable()
export class OauthStateService {
  constructor(private readonly config: ConfigService) {}

  private get key(): string {
    // Reusa a chave-mestra como segredo do HMAC (uso derivado, não expõe).
    return this.config.get<string>('ENCRYPTION_KEY', '');
  }

  sign(empresaId: string, connectorId: string): string {
    const payload = Buffer.from(
      JSON.stringify({
        e: empresaId,
        c: connectorId,
        x: Date.now() + STATE_TTL_MS,
      }),
    ).toString('base64url');
    return `${payload}.${this.mac(payload)}`;
  }

  /** Valida assinatura e validade; retorna a empresa e o conector do state. */
  verify(state: string): OauthState {
    const [payload, mac] = state.split('.');
    if (!payload || !mac) {
      throw new BadRequestException('Autorização inválida (state ausente).');
    }
    const a = Buffer.from(mac);
    const b = Buffer.from(this.mac(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Autorização inválida (state adulterado).');
    }
    let parsed: { e?: string; c?: string; x?: number };
    try {
      parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Autorização inválida (state corrompido).');
    }
    if (!parsed.e || !parsed.x || Date.now() > parsed.x) {
      throw new BadRequestException(
        'Autorização expirada. Clique em "Conectar" novamente.',
      );
    }
    return { empresaId: parsed.e, connectorId: parsed.c ?? '' };
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
