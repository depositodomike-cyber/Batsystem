import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { CryptoService } from '@/ai/crypto';
import type { OrigemOauth } from './oauth-retorno';

/** Validade do `state` anti-CSRF: o usuário tem 10 min para autorizar. */
const STATE_TTL_MS = 10 * 60 * 1000;

export interface OauthState {
  empresaId: string;
  connectorId: string;
  /** PKCE: `code_verifier` gerado no início do fluxo (ausente no Slack). */
  codeVerifier?: string;
  /**
   * Quem iniciou a autorização. Obrigatório nos conectores PESSOAIS: o
   * callback chega sem JWT e é por aqui que sabe de quem é a conta.
   */
  usuarioId?: string;
  /** Quem pediu a autorização: ausente = navegador (web); 'desktop' = Oracle Desktop. */
  origem?: OrigemOauth;
}

/**
 * `state` anti-CSRF dos fluxos OAuth, assinado (HMAC) e sem sessão no
 * servidor: o próprio parâmetro carrega a empresa e o conector, então o
 * callback — que chega sem JWT, direto do navegador — sabe a quem pertence
 * a autorização. Compartilhado por todos os conectores OAuth (Slack, e-mail).
 */
@Injectable()
export class OauthStateService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  private get key(): string {
    // Reusa a chave-mestra como segredo do HMAC (uso derivado, não expõe).
    return this.config.get<string>('ENCRYPTION_KEY', '');
  }

  /**
   * `codeVerifier` (PKCE) viaja dentro do state, CIFRADO: o state passa pelo
   * navegador e pela URL do provedor, e o verifier só pode ser conhecido pelo
   * servidor. Assim o fluxo continua sem armazenamento no servidor.
   */
  sign(
    empresaId: string,
    connectorId: string,
    codeVerifier?: string,
    usuarioId?: string,
    origem?: OrigemOauth,
  ): string {
    const payload = Buffer.from(
      JSON.stringify({
        e: empresaId,
        c: connectorId,
        x: Date.now() + STATE_TTL_MS,
        ...(codeVerifier ? { v: this.crypto.encrypt(codeVerifier) } : {}),
        // Vai dentro do payload assinado: o HMAC impede trocar o dono.
        ...(usuarioId ? { u: usuarioId } : {}),
        ...(origem === 'desktop' ? { o: 'desktop' } : {}),
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
    let parsed: {
      e?: string;
      c?: string;
      x?: number;
      v?: string;
      u?: string;
      o?: string;
    };
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
    let codeVerifier: string | undefined;
    if (parsed.v) {
      try {
        codeVerifier = this.crypto.decrypt(parsed.v);
      } catch {
        throw new BadRequestException('Autorização inválida (state corrompido).');
      }
    }
    return {
      empresaId: parsed.e,
      connectorId: parsed.c ?? '',
      codeVerifier,
      ...(parsed.u ? { usuarioId: parsed.u } : {}),
      ...(parsed.o === 'desktop' ? { origem: 'desktop' as const } : {}),
    };
  }

  /**
   * Origem gravada num `state` de assinatura válida, mesmo expirado — só para
   * decidir PARA ONDE devolver o usuário (web ou app desktop). Nunca autoriza
   * nada: o callback continua passando por `verify`.
   */
  origemDe(state: string | undefined): OrigemOauth | undefined {
    if (!state) return undefined;
    const [payload, mac] = state.split('.');
    if (!payload || !mac) return undefined;
    const a = Buffer.from(mac);
    const b = Buffer.from(this.mac(payload));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
    try {
      const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        o?: string;
      };
      return p.o === 'desktop' ? 'desktop' : undefined;
    } catch {
      return undefined;
    }
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
