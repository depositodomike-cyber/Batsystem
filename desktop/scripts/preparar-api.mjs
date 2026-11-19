// Prepara a API (ts/api) para rodar embutida no Oracle Desktop.
//
// Gera desktop/build/api/ com:
//   dist/                 build do Nest (compilado para cá, sem tocar em ts/api/dist,
//                         que o `start:dev` do dev.cmd usa)
//   prisma/               schema, migrations, data/ e seed.js compilado
//   node_modules/         só dependências de produção (sem o CLI do Prisma)
//   achados.md            registro de segurança lido por src/desktop/liberacao.ts
//
// Uso: node scripts/preparar-api.mjs   (a partir de desktop/)
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(aqui, "..");
const raiz = path.resolve(desktop, "..");
const api = path.join(raiz, "ts", "api");
const destino = path.join(desktop, "build", "api");

const rodar = (cmd, cwd) => {
  console.log(`\n> ${cmd}   (${path.relative(raiz, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } });
};

console.log(`Preparando a API embutida em ${path.relative(raiz, destino)}`);
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

// 1. Build do Nest para uma pasta própria (tsconfig temporário com outDir).
const tsconfigTmp = path.join(api, "tsconfig.desktop.tmp.json");
writeFileSync(
  tsconfigTmp,
  JSON.stringify(
    {
      extends: "./tsconfig.build.json",
      compilerOptions: { outDir: path.relative(api, path.join(destino, "dist")).replace(/\\/g, "/"), sourceMap: false },
    },
    null,
    2,
  ),
);
try {
  rodar(`npx nest build -p tsconfig.desktop.tmp.json`, api);
} finally {
  rmSync(tsconfigTmp, { force: true });
}
if (!existsSync(path.join(destino, "dist", "main.js"))) {
  throw new Error("Build da API não gerou dist/main.js.");
}

// 2. package.json enxuto + lockfile, para instalar só produção.
const pkg = JSON.parse(readFileSync(path.join(api, "package.json"), "utf8"));
writeFileSync(
  path.join(destino, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      // Sem o CLI do Prisma: as migrations são aplicadas pelo app
      // (desktop/src/main/servicos/migracoes.ts) e o client é gerado abaixo
      // com o CLI do próprio ts/api.
      dependencies: pkg.dependencies,
    },
    null,
    2,
  ),
);

// 3. Prisma: schema, migrations, catálogo e seed compilado.
mkdirSync(path.join(destino, "prisma"), { recursive: true });
// Só o engine desta máquina: os alvos Linux do schema (deploy em container)
// não servem ao app Windows e dobram o tamanho do pacote.
writeFileSync(
  path.join(destino, "prisma", "schema.prisma"),
  readFileSync(path.join(api, "prisma", "schema.prisma"), "utf8").replace(
    /binaryTargets\s*=\s*\[[^\]]*\]/,
    'binaryTargets = ["native"]',
  ),
);
cpSync(path.join(api, "prisma", "migrations"), path.join(destino, "prisma", "migrations"), { recursive: true });
cpSync(path.join(api, "prisma", "data"), path.join(destino, "prisma", "data"), { recursive: true });
rodar(
  `npx tsc prisma/seed.ts --outDir "${path.join(destino, "prisma")}" --module commonjs --target es2022 --esModuleInterop --skipLibCheck`,
  api,
);

// 4. Registro de achados de segurança (gate do controle do computador).
cpSync(path.join(raiz, "docs", "security", "achados.md"), path.join(destino, "achados.md"));

// 5. Dependências de produção, reprodutíveis e auditadas (GD-23):
//    a) lockfile enxuto derivado do lockfile do ts/api (mesmas versões);
//    b) correções de segurança SEM mudança de versão major, só neste pacote
//       (o ts/api não é tocado);
//    c) `npm ci` sem scripts de instalação (o client do Prisma é gerado à parte);
//    d) gate: nenhuma vulnerabilidade crítica vai no instalador.
cpSync(path.join(api, "package-lock.json"), path.join(destino, "package-lock.json"));
rodar(`npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund`, destino);
try {
  rodar(`npm audit fix --package-lock-only --omit=dev --ignore-scripts --no-fund`, destino);
} catch {
  // Sai com erro quando sobra algo que só sairia com versão major (--force);
  // o gate de "crítica" logo abaixo é que decide.
  console.log("  (restam vulnerabilidades que exigiriam mudança de versão major)");
}
rodar(`npm ci --omit=dev --ignore-scripts --no-audit --no-fund`, destino);
rodar(`npm audit --omit=dev --audit-level=critical`, destino);
rodar(
  `node "${path.join(api, "node_modules", "prisma", "build", "index.js")}" generate --schema prisma/schema.prisma`,
  destino,
);

console.log("\nAPI embutida pronta.");
