// Define a senha de uma conta direto no banco da API (o do DATABASE_URL do .env).
//
//   node scripts/definir-senha.cjs <email>
//
// A senha é pedida no terminal SEM aparecer na tela, duas vezes, e só o hash
// bcrypt (o mesmo custo da API: 10) é gravado. Nada é registrado em log.
// Rode a partir de ts/api, com o banco (Docker) no ar.
require("dotenv/config");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

// Leitura sem eco: as teclas chegam por `data` e vão para uma fila; cada
// pergunta consome uma linha. Sem eco na tela, sem histórico.
const fila = [];
let linhaAtual = "";
let esperando = null;
function iniciarEntrada() {
  const entrada = process.stdin;
  entrada.setRawMode?.(true);
  entrada.setEncoding("utf8");
  entrada.on("data", (tecla) => {
    for (const c of tecla) {
      if (c === "\u0003") process.exit(130); // Ctrl+C
      if (c === "\r" || c === "\n") {
        if (c === "\n" && linhaAtual === "" && fila.ultimoFoiCR) {
          fila.ultimoFoiCR = false; // \r\n conta como um Enter só
          continue;
        }
        fila.ultimoFoiCR = c === "\r";
        fila.push(linhaAtual);
        linhaAtual = "";
        if (esperando) {
          const r = esperando;
          esperando = null;
          r(fila.shift());
        }
        continue;
      }
      fila.ultimoFoiCR = false;
      if (c === "\u0008" || c === "\u007f") linhaAtual = linhaAtual.slice(0, -1);
      else if (c === "\u0016") continue; // Ctrl+V literal: use o botão direito para colar
      else linhaAtual += c;
    }
  });
  entrada.resume();
}
function perguntarOculto(texto) {
  process.stdout.write(texto);
  return new Promise((resolve) => {
    const pronta = () => {
      process.stdout.write("\n");
      resolve(fila.shift());
    };
    if (fila.length) pronta();
    else esperando = (v) => {
      process.stdout.write("\n");
      resolve(v);
    };
  });
}
function encerrarEntrada() {
  process.stdin.setRawMode?.(false);
  process.stdin.pause();
}

(async () => {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Uso: node scripts/definir-senha.cjs <email>");
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findFirst({ where: { email } });
    if (!usuario) {
      console.error(`Nenhuma conta com o e-mail ${email}.`);
      process.exit(1);
    }
    iniciarEntrada();
    const senha = await perguntarOculto("Nova senha: ");
    const repetida = await perguntarOculto("Repita a senha: ");
    encerrarEntrada();
    if (senha !== repetida) {
      console.error("As senhas não conferem. Nada foi alterado.");
      process.exit(1);
    }
    if (senha.length < 8) {
      console.error("A senha precisa ter ao menos 8 caracteres. Nada foi alterado.");
      process.exit(1);
    }
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash: await bcrypt.hash(senha, 10) },
    });
    console.log(`Senha de ${email} atualizada.`);
  } finally {
    await prisma.$disconnect();
  }
})();
