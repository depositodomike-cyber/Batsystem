// Criptografia do canal Oracle ↔ agente local (SR-20, SR-22, SR-25, SR-27).
// ECDSA P-256 com SHA-256, assinatura no formato IEEE P1363 (r||s), que é o
// padrão do .NET (`ECDsa.SignData`/`VerifyData`). Só `node:crypto`.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const sha256Hex = (d: string | Buffer): string => createHash('sha256').update(d).digest('hex');

/** 16 hex do SHA-256 da chave pública DER: o que o usuário compara (SR-28). */
export function impressaoDigital(spkiDerBase64: string): string {
  const hex = sha256Hex(Buffer.from(spkiDerBase64, 'base64')).slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

/** Chave pública SPKI DER (base64) de um dispositivo → KeyObject. Lança se inválida ou não P-256. */
export function chavePublicaDispositivo(spkiDerBase64: string): KeyObject {
  const k = createPublicKey({ key: Buffer.from(spkiDerBase64, 'base64'), format: 'der', type: 'spki' });
  const det = k.asymmetricKeyDetails;
  if (k.asymmetricKeyType !== 'ec' || det?.namedCurve !== 'prime256v1') {
    throw new Error('Chave do dispositivo precisa ser ECDSA P-256.');
  }
  return k;
}

export function verificarP1363(chave: KeyObject, dados: Buffer, assinaturaB64: string): boolean {
  try {
    const sig = Buffer.from(assinaturaB64, 'base64');
    if (sig.length !== 64) return false;
    return verify('sha256', dados, { key: chave, dsaEncoding: 'ieee-p1363' }, sig);
  } catch {
    return false;
  }
}

/** Texto que o agente assina em cada requisição (SR-22, SR-26: caminho COM query). */
export function mensagemRequisicao(
  metodo: string,
  caminhoComQuery: string,
  timestamp: string,
  nonce: string,
  corpo: Buffer,
): Buffer {
  return Buffer.from(
    `${metodo.toUpperCase()}\n${caminhoComQuery}\n${timestamp}\n${nonce}\n${sha256Hex(corpo)}`,
    'utf8',
  );
}

export function novoNonce(): string {
  return randomBytes(16).toString('hex');
}

export interface Envelope {
  /** Bytes JSON exatos, em base64: o agente verifica ANTES de interpretar. */
  payload: string;
  assinatura: string;
}

/**
 * Chave do servidor (SR-25): `DESKTOP_CHAVE_PRIVADA` (PEM PKCS#8 em base64)
 * ou arquivo gerado no primeiro uso em `.desktop/servidor.pem` (gitignored).
 * Nunca vai para banco, log ou auditoria.
 */
export class ChaveServidor {
  private constructor(private readonly privada: KeyObject, readonly publicaSpkiB64: string) {}

  static carregar(envB64: string | undefined, arquivo: string): ChaveServidor {
    let pem: string;
    if (envB64 && envB64.trim()) {
      pem = Buffer.from(envB64.trim(), 'base64').toString('utf8');
    } else if (existsSync(arquivo)) {
      pem = readFileSync(arquivo, 'utf8');
    } else {
      const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, pem, { encoding: 'utf8', mode: 0o600 });
    }
    const privada = createPrivateKey(pem);
    if (privada.asymmetricKeyType !== 'ec' || privada.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('A chave do servidor desktop precisa ser ECDSA P-256.');
    }
    const publica = createPublicKey(privada).export({ format: 'der', type: 'spki' }).toString('base64');
    return new ChaveServidor(privada, publica);
  }

  static arquivoPadrao(): string {
    return join(process.cwd(), '.desktop', 'servidor.pem');
  }

  get impressao(): string {
    return impressaoDigital(this.publicaSpkiB64);
  }

  /** Assina o objeto como bytes JSON exatos (SR-20). */
  envelope(obj: Record<string, unknown>): Envelope {
    const bytes = Buffer.from(JSON.stringify(obj), 'utf8');
    const sig = sign('sha256', bytes, { key: this.privada, dsaEncoding: 'ieee-p1363' });
    return { payload: bytes.toString('base64'), assinatura: sig.toString('base64') };
  }
}
