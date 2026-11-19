// Gera o instalador do Oracle Desktop (Windows, NSIS).
//
//   node scripts/build.mjs             → release/Oracle-Setup-<versão>.exe (local)
//   node scripts/build.mjs --publicar  → também assina e publica no GitHub Releases
//                                         (exige GH_TOKEN e a chave de assinatura)
//
// Etapas: interface (ts/demo) → API embutida (ts/api) → Oracle Local Agent
// (desktop-agent, self-contained) → testes → electron-builder → [assinatura →
// publicação].
//
// GD-22: o token do GitHub NUNCA fica no ambiente das etapas de build (npm,
// dotnet, testes, electron-builder). Ele só entra no último passo, que apenas
// envia os arquivos já prontos e assinados.
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(aqui, "..");
const raiz = path.resolve(desktop, "..");
const publicar = process.argv.includes("--publicar");

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
/** Ambiente das etapas de build: sem nenhum token. */
const envBuild = { ...process.env };
for (const k of Object.keys(envBuild)) {
  if (/^(GH_TOKEN|GITHUB_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_RELEASE_TOKEN)$/i.test(k)) delete envBuild[k];
}

const rodar = (cmd, cwd = desktop, env = envBuild) => {
  console.log(`\n> ${cmd}   (${path.relative(raiz, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit", env });
};

if (publicar && !token) {
  console.error("Para publicar, defina GH_TOKEN (token do GitHub só com permissão de releases no repositório).");
  process.exit(1);
}

// 1. Interface: build de produção (base "/", API em localhost:3001).
rodar("npm run build", path.join(raiz, "ts", "demo"));
const renderer = path.join(desktop, "build", "renderer");
rmSync(renderer, { recursive: true, force: true });
cpSync(path.join(raiz, "ts", "demo", "dist"), renderer, { recursive: true });

// 2. API embutida (npm ci + auditoria; ver preparar-api.mjs).
rodar("node scripts/preparar-api.mjs");

// 3. Oracle Local Agent, sem depender de .NET instalado na máquina.
const agente = path.join(desktop, "build", "agente");
rmSync(agente, { recursive: true, force: true });
rodar(
  `dotnet publish src/OracleAgent/OracleAgent.csproj -c Release -r win-x64 --self-contained true ` +
    `-p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true ` +
    `-p:EnableCompressionInSingleFile=true -p:DebugType=none -o "${agente}"`,
  path.join(raiz, "desktop-agent"),
);
if (!existsSync(path.join(agente, "oracle-agent.exe"))) throw new Error("Agente não foi publicado.");

// 4. Processo principal + testes de segurança (falha = não empacota).
rodar("npm test");
rodar("npm run build:ts");

// 5. Instalador (sem publicar, sem token).
rodar("npx electron-builder --win --x64 --publish never");

if (publicar) {
  // 6. Assinatura própria do instalador (GD-21).
  rodar("node scripts/assinar-atualizacao.mjs assinar");
  // 7. Envio dos artefatos prontos — única etapa com o token
  // (scripts/publicar-release.mjs: rascunho → 4 arquivos → publica).
  rodar("node scripts/publicar-release.mjs", desktop, { ...envBuild, GH_TOKEN: token });
}

console.log("\nInstalador em desktop/release/.");
