import { app, safeStorage } from "electron";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Configuração do backend embutido, cifrada com o safeStorage (DPAPI) em
 * `userData/backend.bin`: senha do Postgres, segredos da API (JWT_SECRET,
 * ENCRYPTION_KEY) e as variáveis importadas do ambiente de desenvolvimento
 * (credenciais OAuth, token do Telegram...). Nada disso fica em claro no disco.
 */

export interface ConfigBackend {
  /** Senha do superusuário do Postgres (só cria/apaga banco e papel). */
  pgSenha: string;
  /** Senha do papel da aplicação, sem superusuário (GD-05). */
  pgSenhaApp: string;
  /** Variáveis de ambiente da API (sobrepostas pelas de execução: porta, banco...). */
  env: Record<string, string>;
  /** Catálogo (squads/agentes) já semeado neste banco. */
  seedFeito: boolean;
  /** Banco e configuração vieram do ambiente de desenvolvimento. */
  importadoEm?: string;
}

function arquivo(): string {
  return path.join(app.getPath("userData"), "backend.bin");
}

export function lerConfig(): ConfigBackend | null {
  if (!existsSync(arquivo())) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("A cifra do Windows (DPAPI) não está disponível para ler a configuração.");
  }
  const c = JSON.parse(safeStorage.decryptString(readFileSync(arquivo()))) as ConfigBackend;
  return { ...c, env: c.env ?? {}, seedFeito: Boolean(c.seedFeito), pgSenhaApp: c.pgSenhaApp ?? "" };
}

export function salvarConfig(c: ConfigBackend): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("A cifra do Windows (DPAPI) não está disponível para guardar a configuração.");
  }
  writeFileSync(arquivo(), safeStorage.encryptString(JSON.stringify(c)), { mode: 0o600 });
}

/**
 * Variáveis que a API conhece e que a configuração pode definir (allowlist,
 * GD-08). Qualquer outra — `NODE_OPTIONS`, `ELECTRON_*`, variáveis de
 * execução como DATABASE_URL/PORT/HOST — é descartada.
 */
const VARIAVEIS_DA_API =
  /^(JWT_SECRET|JWT_EXPIRES_IN|ENCRYPTION_KEY|AI_MODEL|ANTHROPIC_API_KEY|OPENAI_API_KEY|HEYGEN_API_KEY|IUGU_API_TOKEN|ORQUESTRADOR_ATIVO|DESKTOP_ATIVO|DESKTOP_CHAVE_PRIVADA|TELEGRAM_BOT_TOKEN|FRONT_URL|CORS_ORIGIN|SLACK_[A-Z_]+|GOOGLE_[A-Z_]+|MICROSOFT_[A-Z_]+)$/;

export function variavelDaApi(nome: string): boolean {
  return VARIAVEIS_DA_API.test(nome);
}

export function filtrarVariaveis(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (variavelDaApi(k) && typeof v === "string") out[k] = v;
  return out;
}

/**
 * Chave ECDSA P-256 do gateway desktop, em base64 do PEM (formato de
 * DESKTOP_CHAVE_PRIVADA): fica cifrada aqui, nunca em arquivo (GD-12, SR-25).
 */
export function novaChaveDesktop(): string {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  return Buffer.from(pem, "utf8").toString("base64");
}

/** Primeira execução: segredos novos, gerados nesta máquina. */
export function configInicial(): ConfigBackend {
  return {
    pgSenha: randomBytes(24).toString("base64url"),
    pgSenhaApp: randomBytes(24).toString("base64url"),
    env: {
      JWT_SECRET: randomBytes(48).toString("base64"),
      ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      ORQUESTRADOR_ATIVO: "true",
      DESKTOP_CHAVE_PRIVADA: novaChaveDesktop(),
    },
    seedFeito: false,
  };
}
