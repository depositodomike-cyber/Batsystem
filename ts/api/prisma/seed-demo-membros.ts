/**
 * Popula a organização da conta de demonstração com membros fictícios, para a
 * tela de Membros abrir com uma estrutura realista.
 *
 * Idempotente: upsert por (empresaId, email). Não apaga nada, não mexe em quem
 * não está na lista e nunca cria empresa — se a conta demo não existir, avisa e
 * sai. O `update` também não toca `usuarioId`, preservando vínculos existentes.
 *
 * Rodar:
 *   npm run db:seed:demo:membros
 *   # o loader abaixo aponta para o Neon quando existir .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type MembroStatus } from "@prisma/client";
// Importado, e não reescrito: o catálogo é a fonte única das roles de sistema.
// O módulo é puro (zero imports, nada de Nest), então roda no ts-node do seed.
import {
  ROLES_DE_SISTEMA,
  ROLE_OWNER,
} from "../src/acesso/permissoes.catalog";

/**
 * Duplicado de propósito de `seed-demo-conta.ts`: aquele arquivo chama `main()`
 * no topo do módulo, então importar a constante de lá rodaria o seed da conta
 * como efeito colateral. Extrair para um módulo comum seria refatoração.
 */
const DEMO_EMAIL = "demo@beculture.ai";

interface MembroDemo {
  nome: string;
  email: string;
  area: string;
  cargo: string;
  status: MembroStatus;
  /**
   * E-mail do gestor direto. Referência por e-mail (e não por id) porque os
   * ids são cuid() gerados na criação — o e-mail é a chave estável do seed.
   * Ausente = topo da estrutura.
   */
  gestorEmail?: string;
  /**
   * Código da role de sistema (admin | editor | viewer).
   *
   * PREENCHA SEMPRE: todo membro precisa de ao menos uma role, e este seed
   * escreve direto no banco — ele não passa pelo `MembrosService`, que é quem
   * recusa a criação sem role. Continua opcional no tipo porque a interface é
   * compartilhada com o convidado, que não escolhe role (recebe a Convidado).
   *
   * Referência por código porque as roles são criadas sob demanda pela API e o
   * id é cuid(). Note que role NÃO acompanha cargo de propósito: o exemplo
   * abaixo tem analista com role mais alta que designer.
   */
  roleCodigo?: string;
}

/** Fictícios de propósito — servem só para demonstrar a estrutura. */
const MEMBROS: MembroDemo[] = [
  {
    nome: "Carolina Silva",
    email: "carolina.silva@exemplo.com.br",
    area: "produto",
    cargo: "diretor",
    status: "ativo",
    roleCodigo: "admin",
  },
  {
    nome: "Michael Araújo",
    email: "michael.araujo@exemplo.com.br",
    area: "produto",
    cargo: "gerente",
    status: "ativo",
    gestorEmail: "carolina.silva@exemplo.com.br",
    roleCodigo: "editor",
  },
  {
    nome: "Renato Costa",
    email: "renato.costa@exemplo.com.br",
    area: "produto",
    cargo: "coordenador",
    status: "ativo",
    gestorEmail: "michael.araujo@exemplo.com.br",
    roleCodigo: "editor",
  },
  {
    nome: "Amanda Reis",
    email: "amanda.reis@exemplo.com.br",
    area: "produto",
    cargo: "designer",
    status: "convite_pendente",
    gestorEmail: "michael.araujo@exemplo.com.br",
    roleCodigo: "viewer",
  },
  {
    nome: "João Santos",
    email: "joao.santos@exemplo.com.br",
    area: "marketing",
    cargo: "analista",
    status: "ativo",
    gestorEmail: "renato.costa@exemplo.com.br",
    roleCodigo: "admin",
  },
  {
    nome: "Beatriz Lopes",
    email: "beatriz.lopes@exemplo.com.br",
    area: "pessoas",
    cargo: "business-partner",
    status: "convite_pendente",
    gestorEmail: "carolina.silva@exemplo.com.br",
    roleCodigo: "viewer",
  },
  {
    nome: "Eduardo Nunes",
    email: "eduardo.nunes@exemplo.com.br",
    area: "financeiro",
    cargo: "analista",
    status: "inativo",
    roleCodigo: "viewer",
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

// Base local, depois Neon (.env.local) sobrescreve — é o banco do deploy,
// mesma precedência de `seed-demo-conta.ts`. A exceção: se quem chamou já
// exportou DATABASE_URL, esse valor ganha, para dar como rodar contra o
// Postgres local sem editar arquivo nenhum:
//   DATABASE_URL=postgresql://... npm run db:seed:demo:membros
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

  const now = new Date();

  for (const m of MEMBROS) {
    const email = m.email.trim().toLowerCase();
    await prisma.membro.upsert({
      where: { empresaId_email: { empresaId: owner.empresaId, email } },
      create: {
        empresaId: owner.empresaId,
        nome: m.nome,
        email,
        area: m.area,
        cargo: m.cargo,
        status: m.status,
        convidadoEm: m.status === "convite_pendente" ? now : null,
        desativadoEm: m.status === "inativo" ? now : null,
      },
      // Não toca usuarioId: se o vínculo com uma conta já existe, é preservado.
      update: {
        nome: m.nome,
        area: m.area,
        cargo: m.cargo,
        status: m.status,
      },
    });
  }

  // Segunda passada para a hierarquia: `gestorId` só pode ser resolvido depois
  // que todos existem, porque um gestor pode aparecer na lista depois de quem
  // responde a ele. Referência por e-mail — os ids são cuid() gerados agora.
  const porEmail = new Map(
    (
      await prisma.membro.findMany({
        where: { empresaId: owner.empresaId },
        select: { id: true, email: true, gestorId: true },
      })
    ).map((m) => [m.email, m]),
  );

  let vinculos = 0;
  for (const m of MEMBROS) {
    if (!m.gestorEmail) continue;
    const membro = porEmail.get(m.email.trim().toLowerCase());
    const gestor = porEmail.get(m.gestorEmail.trim().toLowerCase());
    if (!membro || !gestor) continue;
    // Idempotente: só escreve quando muda, e nunca sobrescreve um gestor que
    // alguém já ajustou à mão para outro membro.
    if (membro.gestorId === gestor.id) continue;
    await prisma.membro.update({
      where: { id: membro.id },
      data: { gestorId: gestor.id },
    });
    vinculos++;
  }
  if (vinculos > 0) console.log(`Relações de gestor definidas: ${vinculos}`);

  // Terceira passada: roles. Depende das roles de sistema já existirem, o que
  // acontece no primeiro GET /empresa/roles — o seed não as cria para não
  // duplicar o catálogo, só usa o que estiver lá.
  // Garante as roles de sistema com o MESMO upsert por (empresaId, codigo) que
  // `RolesService.garantirRolesDeSistema` usa, a partir do mesmo catálogo. Antes
  // isto dependia de alguém abrir a aba Acesso para o primeiro GET criá-las — o
  // que deixava o seed pela metade na primeira execução.
  for (const padrao of ROLES_DE_SISTEMA) {
    await prisma.role.upsert({
      where: {
        empresaId_codigo: { empresaId: owner.empresaId, codigo: padrao.codigo },
      },
      create: {
        empresaId: owner.empresaId,
        codigo: padrao.codigo,
        nome: padrao.nome,
        descricao: padrao.descricao,
        tipo: "sistema",
        permissoes: padrao.permissoes,
      },
      update: {
        nome: padrao.nome,
        descricao: padrao.descricao,
        permissoes: padrao.permissoes,
      },
    });
  }

  const rolePorCodigo = new Map(
    (
      await prisma.role.findMany({
        where: { empresaId: owner.empresaId, codigo: { not: null } },
        select: { id: true, codigo: true },
      })
    ).map((r) => [r.codigo!, r.id]),
  );

  // A role Owner é exclusiva de quem criou a organização: atribuída aqui ao
  // membro vinculado ao `Usuario` com `role = 'owner'`, que é a mesma condição
  // que a API exige em `MembrosService.exigirRoleDoTenant`. Nenhum membro da
  // lista fictícia acima pode recebê-la.
  //
  // As roles entram como VÍNCULO em `membro_roles` — a coluna `membros.roleId`
  // é legado congelado desde que um membro pode ter até duas. Escrevê-la aqui
  // rodaria sem erro e deixaria a aba Acesso mostrando zero role em todo mundo.
  const roleOwnerId = rolePorCodigo.get(ROLE_OWNER);
  if (roleOwnerId) {
    const contaOwner = await prisma.usuario.findFirst({
      where: { empresaId: owner.empresaId, role: "owner" },
      // `orderBy` para a escolha não depender da ordem física do Postgres. O
      // índice único parcial já impede duas contas owner na mesma empresa, mas
      // um banco anterior a ele pode ter o estado — e aí o vínculo Owner iria
      // para uma ou outra conta a cada execução.
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });
    if (contaOwner) {
      const membroOwner = await prisma.membro.findFirst({
        where: { empresaId: owner.empresaId, usuarioId: contaOwner.id },
        select: {
          id: true,
          nome: true,
          // O vínculo, não a coluna legada `roleId`: desde que um membro pode
          // ter duas roles, é `membro_roles` que manda.
          rolesAtribuidas: { select: { roleId: true } },
        },
      });
      if (!membroOwner) {
        console.log(
          "Responsável pela conta não tem membro vinculado — role Owner não atribuída.",
        );
      } else if (
        !membroOwner.rolesAtribuidas.some((v) => v.roleId === roleOwnerId)
      ) {
        // `create` do vínculo, e não `update` do membro: acrescenta a role
        // Owner sem tirar nenhuma outra que ele já tenha. A unique do vínculo
        // já impediria a duplicata, e a guarda acima evita a escrita inútil.
        await prisma.membroRole.create({
          data: { membroId: membroOwner.id, roleId: roleOwnerId },
        });
        console.log(`Role Owner atribuída a ${membroOwner.nome}.`);
      }
    }
  }

  {
    const atuais = new Map(
      (
        await prisma.membro.findMany({
          where: { empresaId: owner.empresaId },
          select: {
            id: true,
            email: true,
            rolesAtribuidas: { select: { roleId: true } },
          },
        })
      ).map((m) => [m.email, m]),
    );

    let atribuidas = 0;
    for (const m of MEMBROS) {
      if (!m.roleCodigo) continue;
      // Owner nunca vem por aqui: é exclusiva do responsável pela conta e foi
      // atribuída acima. A guarda existe para um `roleCodigo: "owner"` posto na
      // lista por engano não furar a regra que a API aplica.
      if (m.roleCodigo === ROLE_OWNER) continue;
      const membro = atuais.get(m.email.trim().toLowerCase());
      const roleId = rolePorCodigo.get(m.roleCodigo);
      if (!membro || !roleId) continue;
      // Idempotente pelo VÍNCULO. Cada membro da lista fictícia tem um
      // `roleCodigo` só, então o seed nunca cria a segunda role de ninguém —
      // e também não tira a segunda que alguém tenha ganhado pela tela.
      if (membro.rolesAtribuidas.some((v) => v.roleId === roleId)) continue;
      await prisma.membroRole.create({
        data: { membroId: membro.id, roleId },
      });
      atribuidas++;
    }
    if (atribuidas > 0) console.log(`Roles atribuídas: ${atribuidas}`);
  }

  const total = await prisma.membro.count({
    where: { empresaId: owner.empresaId },
  });
  console.log(
    `Membros demo garantidos: ${MEMBROS.length} (total na organização: ${total})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
