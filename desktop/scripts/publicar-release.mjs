// Envia para o GitHub Releases os arquivos JÁ gerados e assinados da versão
// atual (package.json → version), pela API REST do GitHub.
//
//   npm run publicar               envia (exige GH_TOKEN)
//   npm run publicar -- --simular  só confere os arquivos e mostra o plano
//
// Usado no lugar de `electron-builder publish`, que no 26.18.1 funde a config
// do package.json com ela mesma e recusa o bloco `publish`.
//
// Ordem segura: a release nasce como RASCUNHO, recebe os 4 arquivos e só então
// é publicada — nenhum app instalado vê uma release incompleta (sem o
// manifesto assinado, ele recusaria a atualização).
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Erros do GitHub em linguagem clara (o token nunca aparece).
process.on("uncaughtException", (e) => {
  const dicas = {
    401: "Token inválido ou expirado. Gere outro no GitHub e informe de novo.",
    403: "O token não tem permissão para criar releases. Fine-grained: Contents = Read and write no repositório Batsystem. Classic: escopo public_repo.",
    404: "Repositório não encontrado para este token. No fine-grained, confira se o Batsystem está em 'Only select repositories'.",
    422: "O GitHub recusou os dados da release (talvez a tag já exista com outro conteúdo).",
  };
  console.error(`\nFalha no envio: ${e.message}`);
  if (dicas[e.status]) console.error(dicas[e.status]);
  console.error("Se a release ficou como rascunho, é só rodar `npm run publicar` de novo: o envio continua de onde parou.");
  // exitCode (e não exit): sair à força com o fetch aberto derruba o Node no Windows.
  process.exitCode = 1;
});

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(desktop, "package.json"), "utf8"));
const versao = pkg.version;
const destino = (pkg.build?.publish ?? []).find((p) => p.provider === "github");
if (!destino?.owner || !destino?.repo) {
  console.error("package.json → build.publish sem destino github (owner/repo).");
  process.exit(1);
}
const { owner, repo } = destino;
const tag = `v${versao}`;
const simular = process.argv.includes("--simular");

const arquivos = [
  `Oracle-Setup-${versao}.exe`,
  `Oracle-Setup-${versao}.exe.blockmap`,
  "latest.yml",
  `oracle-atualizacao-${versao}.json`,
];
for (const a of arquivos) {
  if (!existsSync(path.join(desktop, "release", a))) {
    console.error(`Arquivo ausente: release/${a}. Gere com "npm run dist" e assine com "node scripts/assinar-atualizacao.mjs assinar".`);
    process.exit(1);
  }
}
// O latest.yml precisa ser desta versão (senão os apps baixariam outra coisa).
const yml = readFileSync(path.join(desktop, "release", "latest.yml"), "utf8");
if (!new RegExp(`^version:\\s*${versao.replace(/\./g, "\\.")}\\s*$`, "m").test(yml)) {
  console.error(`release/latest.yml não é da versão ${versao}. Gere de novo com "npm run dist".`);
  process.exit(1);
}
const manifesto = JSON.parse(readFileSync(path.join(desktop, "release", `oracle-atualizacao-${versao}.json`), "utf8"));
if (manifesto.versao !== versao || manifesto.arquivo !== `Oracle-Setup-${versao}.exe`) {
  console.error("O manifesto assinado não corresponde a esta versão. Rode: node scripts/assinar-atualizacao.mjs assinar");
  process.exit(1);
}

console.log(`Release ${tag} em ${owner}/${repo}:`);
for (const a of arquivos) {
  console.log(`  - ${a} (${(statSync(path.join(desktop, "release", a)).size / 1024 / 1024).toFixed(1)} MB)`);
}
if (simular) {
  console.log("\n(simulação: nada foi enviado)");
  process.exit(0);
}

// Colar no terminal costuma trazer espaço, quebra de linha ou aspas junto.
const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "")
  .trim()
  .replace(/^["']|["']$/g, "");
if (!token) {
  console.error("Defina GH_TOKEN (token com permissão Contents: read and write no repositório).");
  process.exit(1);
}
// Tokens do GitHub: "github_pat_…" (fine-grained) ou "ghp_…" (classic), só
// letras, números e "_". O token nunca é exibido; só o diagnóstico.
if (!/^(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]+$/.test(token)) {
  const invalidos = [...new Set([...token].filter((c) => !/[A-Za-z0-9_]/.test(c)))]
    .map((c) => (c === " " ? "espaço" : `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`))
    .join(", ");
  console.error(
    "O GH_TOKEN não parece um token do GitHub.\n" +
      `  tamanho: ${token.length} caracteres\n` +
      `  começa com github_pat_ ou ghp_: ${/^(github_pat_|ghp_)/.test(token) ? "sim" : "NÃO"}\n` +
      (invalidos ? `  caracteres inválidos: ${invalidos}\n` : "") +
      "Copie o token de novo (botão de copiar do GitHub) e informe-o outra vez.",
  );
  process.exit(1);
}

const API = `https://api.github.com/repos/${owner}/${repo}`;
const cabecalhos = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "oracle-desktop-release",
};

async function chamar(url, opcoes = {}) {
  const r = await fetch(url, { ...opcoes, headers: { ...cabecalhos, ...(opcoes.headers ?? {}) } });
  const texto = await r.text();
  const corpo = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    const msg = corpo?.message ?? r.statusText;
    const err = new Error(`${opcoes.method ?? "GET"} ${url.replace(/\?.*/, "")} → ${r.status}: ${msg}`);
    err.status = r.status;
    throw err;
  }
  return corpo;
}

// 1. Release existente com esta tag? Só continua se ainda for rascunho.
let release = null;
try {
  release = await chamar(`${API}/releases/tags/${tag}`);
} catch (e) {
  if (e.status !== 404) throw e;
}
if (!release) {
  // A busca por tag não enxerga rascunhos: procura na lista também.
  const lista = await chamar(`${API}/releases?per_page=50`);
  release = lista.find((r) => r.tag_name === tag) ?? null;
}
if (release && !release.draft) {
  console.error(`A release ${tag} já está publicada. Suba a versão em package.json para publicar outra.`);
  process.exit(1);
}
if (!release) {
  release = await chamar(`${API}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      name: `Oracle ${versao}`,
      body: `Oracle Desktop ${versao}.\n\nBaixe e execute \`Oracle-Setup-${versao}.exe\`. Quem já tem o Oracle instalado recebe esta versão automaticamente.`,
      draft: true,
    }),
  });
  console.log(`Rascunho criado (id ${release.id}).`);
} else {
  console.log(`Continuando o rascunho existente (id ${release.id}).`);
}

// 2. Arquivos: substitui os de mesmo nome que já estejam no rascunho.
const existentes = new Map((release.assets ?? []).map((a) => [a.name, a.id]));
for (const nome of arquivos) {
  if (existentes.has(nome)) {
    await chamar(`${API}/releases/assets/${existentes.get(nome)}`, { method: "DELETE" });
  }
  const dados = readFileSync(path.join(desktop, "release", nome));
  process.stdout.write(`Enviando ${nome}… `);
  await chamar(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(nome)}`,
    { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: dados },
  );
  console.log("ok");
}

// 3. Publica só depois de todos os arquivos no lugar.
const publicada = await chamar(`${API}/releases/${release.id}`, {
  method: "PATCH",
  body: JSON.stringify({ draft: false }),
});
console.log(`\nPublicada: ${publicada.html_url}`);
