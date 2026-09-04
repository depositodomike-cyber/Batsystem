/**
 * Popula a organização da conta de demonstração com ÁREAS e CARGOS (entidades
 * da V4 — Estrutura) e liga cada membro às suas por `areaId`/`cargoId`.
 *
 * Por que existe, além de `seed-demo-membros.ts`: aquele seed grava `area` e
 * `cargo`, que o schema marca como LEGADO e "NUNCA MAIS ESCRITOS" (ver
 * `Membro.area`). Com ele sozinho, a organização demo fica com membros cujas
 * Área/Cargo não existem como entidade — as telas de Estrutura abrem vazias e
 * os seletores do formulário de membro não têm o que oferecer. Este seed cobre
 * essa lacuna, e usa os códigos legados só como CHAVE DE-PARA para descobrir a
 * qual entidade cada membro pertence; não os reescreve.
 *
 * Idempotente: upsert por (empresaId, nome) — a mesma unique do banco. Não
 * apaga nada, não cria empresa e não toca em membro fora da lista de-para.
 * Rodar duas vezes não duplica nem altera o que já está certo.
 *
 * Rodar (contra o Postgres LOCAL, que é o banco que a API lê):
 *   DATABASE_URL=postgresql://... npm run db:seed:demo:estrutura
 *
 * Sem DATABASE_URL explícito o loader abaixo cai no .env.local quando ele
 * existe — que é o banco do DEPLOY. Passe a URL de propósito.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

/** Mesma duplicação consciente de `seed-demo-membros.ts` (aquele módulo roda no import). */
const DEMO_EMAIL = "demo@beculture.ai";

/**
 * Área da organização. `codigoLegado` é o valor que ficou em `membros.area`
 * antes da V4 — serve só para achar os membros e ligá-los a esta entidade.
 */
interface AreaDemo {
  nome: string;
  descricao: string;
  codigoLegado: string;
  status?: "ativo" | "inativo";
}

/** Fictícias de propósito — existem só para demonstrar a estrutura. */
const AREAS: AreaDemo[] = [
  {
    nome: "Produto",
    descricao: "Descoberta, definição e evolução da plataforma.",
    codigoLegado: "produto",
  },
  {
    nome: "Marketing",
    descricao: "Posicionamento, conteúdo e geração de demanda.",
    codigoLegado: "marketing",
  },
  {
    nome: "Pessoas & Cultura",
    descricao: "Atração, desenvolvimento e cultura organizacional.",
    codigoLegado: "pessoas",
  },
  {
    nome: "Financeiro",
    descricao: "Planejamento financeiro, orçamento e controladoria.",
    codigoLegado: "financeiro",
  },
  {
    nome: "Tecnologia",
    descricao: "Engenharia, infraestrutura e segurança.",
    codigoLegado: "tecnologia",
  },
  {
    // Inativa de propósito: a tela precisa de um caso não-ativo para mostrar
    // o filtro de status e o rótulo de desativada.
    nome: "Operações",
    descricao: "Processos internos. Área descontinuada nesta reorganização.",
    codigoLegado: "operacoes",
    status: "inativo",
  },
];

interface CargoDemo {
  nome: string;
  descricao: string;
  codigoLegado: string;
  status?: "ativo" | "inativo";
}

/**
 * Cargo é a POSIÇÃO profissional — não define hierarquia nem permissão (ver os
 * comentários de `Cargo` no schema). Por isso a lista abaixo mistura níveis sem
 * qualquer ordenação implícita.
 */
const CARGOS: CargoDemo[] = [
  {
    nome: "Diretor(a)",
    descricao: "Responde pela estratégia e pelos resultados da área.",
    codigoLegado: "diretor",
  },
  {
    nome: "Gerente",
    descricao: "Conduz o time e a operação da área no dia a dia.",
    codigoLegado: "gerente",
  },
  {
    nome: "Coordenador(a)",
    descricao: "Coordena entregas e apoia a gestão do time.",
    codigoLegado: "coordenador",
  },
  {
    nome: "Analista",
    descricao: "Executa análises e entregas da sua especialidade.",
    codigoLegado: "analista",
  },
  {
    nome: "Product Designer",
    descricao: "Desenha a experiência e a interface do produto.",
    codigoLegado: "designer",
  },
  {
    nome: "Business Partner",
    descricao: "Faz a ponte entre Pessoas & Cultura e as demais áreas.",
    codigoLegado: "business-partner",
  },
  {
    nome: "Engenheiro(a) de Software",
    descricao: "Constrói e mantém a plataforma.",
    codigoLegado: "engenheiro",
  },
  {
    nome: "Estagiário(a)",
    descricao: "Em formação, com acompanhamento de um responsável.",
    codigoLegado: "estagiario",
    status: "inativo",
  },
];

function carregarEnvArquivo(nome: string, sobrescrever = false): void {
  const caminho = resolve(__dirname, "..", nome);
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const chave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (sobrescrever || process.env[chave] == null || process.env[chave] === "") {
      process.env[chave] = valor;
    }
  }
}

// Mesma precedência dos outros seeds: .env, depois .env.local sobrescreve, e
// quem exportou DATABASE_URL na chamada ganha de ambos.
const urlDoChamador = process.env.DATABASE_URL;
carregarEnvArquivo(".env");
carregarEnvArquivo(".env.local", true);
if (urlDoChamador) {
  process.env.DATABASE_URL = urlDoChamador;
  process.env.DATABASE_URL_UNPOOLED = urlDoChamador;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const host =
    process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "(desconhecido)";
  console.log(`Banco: ${host}`);

  const owner = await prisma.usuario.findUnique({
    where: { email: DEMO_EMAIL },
    select: { empresaId: true },
  });

  if (!owner) {
    console.log(
      `Conta demo (${DEMO_EMAIL}) não existe — rode "npm run db:seed:demo" primeiro. Nada a fazer.`,
    );
    return;
  }

  const empresaId = owner.empresaId;
  const now = new Date();

  // ---- Áreas ----
  const areaIdPorCodigo = new Map<string, string>();
  for (const a of AREAS) {
    const status = a.status ?? "ativo";
    const area = await prisma.area.upsert({
      where: { empresaId_nome: { empresaId, nome: a.nome } },
      create: {
        empresaId,
        nome: a.nome,
        descricao: a.descricao,
        status,
        desativadoEm: status === "inativo" ? now : null,
      },
      update: { descricao: a.descricao, status },
      select: { id: true },
    });
    areaIdPorCodigo.set(a.codigoLegado, area.id);
  }

  // ---- Cargos ----
  const cargoIdPorCodigo = new Map<string, string>();
  for (const c of CARGOS) {
    const status = c.status ?? "ativo";
    const cargo = await prisma.cargo.upsert({
      where: { empresaId_nome: { empresaId, nome: c.nome } },
      create: {
        empresaId,
        nome: c.nome,
        descricao: c.descricao,
        status,
        desativadoEm: status === "inativo" ? now : null,
      },
      update: { descricao: c.descricao, status },
      select: { id: true },
    });
    cargoIdPorCodigo.set(c.codigoLegado, cargo.id);
  }

  console.log(`Áreas garantidas: ${AREAS.length} · Cargos: ${CARGOS.length}`);

  // ---- Vínculo dos membros ----
  // O de-para usa os códigos legados que já estão gravados em cada membro, e
  // só escreve quando o vínculo muda — assim quem já foi reconfigurado à mão
  // pela tela não é sobrescrito por uma segunda execução.
  const membros = await prisma.membro.findMany({
    where: { empresaId },
    select: { id: true, nome: true, area: true, cargo: true, areaId: true, cargoId: true },
  });

  let ligados = 0;
  const semDePara: string[] = [];

  for (const m of membros) {
    const areaId = m.area ? areaIdPorCodigo.get(m.area) : undefined;
    const cargoId = m.cargo ? cargoIdPorCodigo.get(m.cargo) : undefined;

    // O dono da conta ("Time BeCulture") não tem área/cargo legados — fica de
    // fora de propósito, e não é um erro.
    if (!areaId && !cargoId) continue;
    if ((m.area && !areaId) || (m.cargo && !cargoId)) semDePara.push(m.nome);

    const data: { areaId?: string; cargoId?: string } = {};
    if (areaId && m.areaId !== areaId) data.areaId = areaId;
    if (cargoId && m.cargoId !== cargoId) data.cargoId = cargoId;
    if (Object.keys(data).length === 0) continue;

    await prisma.membro.update({ where: { id: m.id }, data });
    ligados++;
  }

  if (semDePara.length > 0) {
    console.log(
      `Sem de-para para o código legado (área/cargo não criados): ${semDePara.join(", ")}`,
    );
  }

  const [totalAreas, totalCargos, comArea, comCargo] = await Promise.all([
    prisma.area.count({ where: { empresaId } }),
    prisma.cargo.count({ where: { empresaId } }),
    prisma.membro.count({ where: { empresaId, areaId: { not: null } } }),
    prisma.membro.count({ where: { empresaId, cargoId: { not: null } } }),
  ]);

  console.log(`Membros ligados nesta execução: ${ligados}`);
  console.log(
    `Estado final — áreas: ${totalAreas}, cargos: ${totalCargos}, membros com área: ${comArea}, com cargo: ${comCargo}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
