// Hook afterPack do electron-builder: copia as dependências de produção da API
// embutida para resources/api/node_modules.
//
// O electron-builder nunca copia pastas `node_modules` de `extraResources`
// (nem com filtro explícito), e a API precisa delas em tempo de execução.
// Roda antes de o instalador NSIS ser montado.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");

exports.default = async function aposEmpacotar(contexto) {
  const origem = path.resolve(__dirname, "..", "build", "api", "node_modules");
  const destino = path.join(contexto.appOutDir, "resources", "api", "node_modules");
  if (!existsSync(origem)) throw new Error(`Dependências da API ausentes: ${origem} (rode scripts/preparar-api.mjs)`);
  cpSync(origem, destino, {
    recursive: true,
    filter: (p) => !p.endsWith(".map") && !p.endsWith(".d.ts"),
  });
  console.log(`  • dependências da API copiadas  destino=${destino}`);
};
