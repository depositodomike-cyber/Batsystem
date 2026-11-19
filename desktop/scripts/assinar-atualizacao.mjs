// Chave e assinatura das atualizações do Oracle Desktop (GD-21).
//
//   node scripts/assinar-atualizacao.mjs gerar
//       Cria o par Ed25519 (se ainda não existir). A chave PRIVADA fica fora do
//       repositório, em %USERPROFILE%\.oracle-desktop\chave-atualizacao.pem
//       (ou em ORACLE_CHAVE_ATUALIZACAO). A pública é gravada em
//       src/main/chaveAtualizacao.ts, que vai no código do app.
//       FAÇA BACKUP da chave privada: sem ela, os apps instalados recusam as
//       próximas atualizações (seria preciso reinstalar manualmente).
//
//   node scripts/assinar-atualizacao.mjs assinar
//       Assina o instalador da versão atual (release/Oracle-Setup-<v>.exe) e
//       grava release/oracle-atualizacao-<v>.json, publicado junto na release.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arquivoChave =
  process.env.ORACLE_CHAVE_ATUALIZACAO || path.join(os.homedir(), ".oracle-desktop", "chave-atualizacao.pem");
const arquivoPublica = path.join(desktop, "src", "main", "chaveAtualizacao.ts");

function gravarPublica(spkiB64) {
  writeFileSync(
    arquivoPublica,
    `/**
 * Chave pública Ed25519 (SPKI DER, base64) que verifica as atualizações do
 * Oracle Desktop (GD-21). Gerada por scripts/assinar-atualizacao.mjs; a chave
 * privada correspondente fica FORA do repositório.
 */
export const CHAVE_PUBLICA_ATUALIZACAO = ${JSON.stringify(spkiB64)};
`,
  );
}

const comando = process.argv[2];

if (comando === "gerar") {
  if (existsSync(arquivoChave)) {
    const publica = createPublicKey(createPrivateKey(readFileSync(arquivoChave)))
      .export({ format: "der", type: "spki" })
      .toString("base64");
    gravarPublica(publica);
    console.log(`Chave já existe em ${arquivoChave}; pública regravada em src/main/chaveAtualizacao.ts.`);
  } else {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    mkdirSync(path.dirname(arquivoChave), { recursive: true });
    writeFileSync(arquivoChave, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
    gravarPublica(publicKey.export({ format: "der", type: "spki" }).toString("base64"));
    console.log(`Chave privada criada em ${arquivoChave}. FAÇA BACKUP dela num lugar seguro.`);
  }
} else if (comando === "assinar") {
  if (!existsSync(arquivoChave)) {
    console.error(`Chave privada não encontrada em ${arquivoChave}. Rode "gerar" ou defina ORACLE_CHAVE_ATUALIZACAO.`);
    process.exit(1);
  }
  const versao = JSON.parse(readFileSync(path.join(desktop, "package.json"), "utf8")).version;
  const arquivo = `Oracle-Setup-${versao}.exe`;
  const caminho = path.join(desktop, "release", arquivo);
  if (!existsSync(caminho)) {
    console.error(`Instalador não encontrado: ${caminho}`);
    process.exit(1);
  }
  const sha512 = createHash("sha512").update(readFileSync(caminho)).digest("base64");
  const mensagem = Buffer.from(`oracle-desktop-atualizacao\n${versao}\n${arquivo}\n${sha512}`, "utf8");
  const assinatura = sign(null, mensagem, createPrivateKey(readFileSync(arquivoChave))).toString("base64");
  const saida = path.join(desktop, "release", `oracle-atualizacao-${versao}.json`);
  writeFileSync(saida, JSON.stringify({ versao, arquivo, sha512, assinatura }, null, 2));
  console.log(`Manifesto assinado: ${saida}`);
} else {
  console.error("Uso: node scripts/assinar-atualizacao.mjs gerar|assinar");
  process.exit(2);
}
