// Executa um script Node (CLI do Prisma, seed) dentro de um utilityProcess do
// Electron e garante que o processo termine quando o script acabar.
//
// Com o fuse RunAsNode desligado (GD-16), o app não pode se rodar como "node".
// E um utilityProcess NÃO termina sozinho quando o script acaba (o loop do
// Electron continua vivo; nem `beforeExit` dispara). Daí os dois modos:
//
//   executor.cjs --seed <seed.js>        termina quando o seed chama
//                                        `prisma.$disconnect()` (último passo dele)
//   executor.cjs <cli.js> [args...]      termina quando sobram só os recursos de
//                                        base (os pipes de stdout/stderr) por 1,5 s
//
// O processo pai ainda tem um timeout como rede de segurança.
const path = require("node:path");

const args = process.argv.slice(2);
const modoSeed = args[0] === "--seed";
if (modoSeed) args.shift();
const [script, ...resto] = args;
if (!script) {
  console.error("executor: script ausente");
  process.exit(2);
}

let terminado = false;
function terminar(codigo) {
  if (terminado) return;
  terminado = true;
  // Dá tempo de o stdout/stderr escoarem para o log do app.
  setTimeout(() => process.exit(codigo), 50);
}

process.on("uncaughtException", (e) => {
  console.error(e);
  terminar(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  terminar(1);
});

process.argv = [process.argv[0], script, ...resto];

if (modoSeed) {
  const { PrismaClient } = require(
    require.resolve("@prisma/client", { paths: [path.dirname(script)] }),
  );
  const desconectar = PrismaClient.prototype.$disconnect;
  PrismaClient.prototype.$disconnect = async function (...a) {
    try {
      return await desconectar.apply(this, a);
    } finally {
      terminar(process.exitCode ?? 0);
    }
  };
  require(script);
} else {
  const base = () =>
    process.getActiveResourcesInfo().filter((r) => r !== "Timeout" && r !== "PipeWrap").length;
  require(script);
  let ociosos = 0;
  setInterval(() => {
    ociosos = base() === 0 ? ociosos + 1 : 0;
    if (ociosos >= 8) terminar(process.exitCode ?? 0);
  }, 200);
}
