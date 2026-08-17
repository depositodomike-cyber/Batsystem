/**
 * Reducer puro do protótipo.
 *
 * As regras de negócio são reforçadas AQUI, não só na interface: se um bug de UI
 * habilitasse convite numa organização b2c, o reducer recusa. Defesa em
 * profundidade — a regra não depende de um `disabled` ter sido lembrado.
 */

import invariant from "tiny-invariant";

import { DEMO_LOGIN } from "@/constants/demoLogin";
import {
  conteudoVazio,
  estadoSemeado,
  SENHA_DEMONSTRACAO,
} from "./fixtures";
import { podeConvidar } from "./regras";
import type {
  EstadoPrototipo,
  Pagador,
  PapelNaOrganizacao,
} from "./types";

export type AcaoPrototipo =
  | {
      tipo: "conta/criar";
      payload: { nome: string; email: string; senha: string };
    }
  | {
      tipo: "organizacao/configurar";
      payload: {
        nome: string;
        pagador: Omit<Pagador, "id">;
        /** Convites da própria criação. Ignorados se a regra não permitir. */
        emails?: string[];
      };
    }
  | {
      tipo: "organizacao/convidar";
      payload: { organizacaoId: string; emails: string[] };
    }
  | {
      tipo: "organizacao/alterarPapel";
      payload: { membroId: string; papel: PapelNaOrganizacao };
    }
  | {
      tipo: "organizacao/excluir";
      payload: { organizacaoId: string };
    }
  /**
   * Cria um repositório vazio no mesmo escopo do contexto atual (ou do primeiro
   * repositório acessível) e já o seleciona. Não herda pasta nem conteúdo.
   */
  | { tipo: "repositorio/criar"; payload: { nome: string } }
  | { tipo: "sessao/login"; payload: { email: string } }
  /**
   * Garante uma sessão para um usuário autenticado na app real: reaproveita a
   * conta do protótipo com esse e-mail ou cria uma, sempre com apenas o
   * escopo pessoal (sem organização ainda).
   */
  | { tipo: "sessao/garantir"; payload: { nome: string; email: string } }
  /**
   * Alinha a senha do protótipo com a que a API acabou de aceitar. Evita que
   * o próximo login local recuse a conta do time (e outras contas reais).
   */
  | {
      tipo: "sessao/sincronizarSenha";
      payload: { email: string; senha: string };
    }
  | { tipo: "sessao/logout" }
  | { tipo: "contexto/abrirRepositorio"; payload: { repositorioId: string } }
  /**
   * Troca de organização (menu de perfil): abre o primeiro repositório do
   * escopo. `organizacaoId: null` = organização pessoal.
   */
  | {
      tipo: "contexto/abrirOrganizacao";
      payload: { organizacaoId: string | null };
    }
  | { tipo: "demo/forcarPapel"; payload: { papel: PapelNaOrganizacao | null } }
  | { tipo: "prototipo/reiniciar" };

/**
 * Ids únicos por criação. Contador em memória reinicia a cada reload e colidia
 * com contas já persistidas (`u-1` de novo → `find` pegava a conta antiga e
 * misturava repositórios).
 */
function novoId(prefixo: string): string {
  return `${prefixo}-${crypto.randomUUID()}`;
}

function agora(): string {
  return new Date().toISOString();
}

function ehContaDoTime(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_LOGIN.email.toLowerCase();
}

function senhaPlaceholder(email: string): string {
  return ehContaDoTime(email) ? DEMO_LOGIN.senha : SENHA_DEMONSTRACAO;
}

/** Primeiro repositório acessível ao usuário (org preferida, senão pessoal). */
function primeiroRepositorioDoUsuario(
  estado: EstadoPrototipo,
  usuarioId: string,
) {
  const orgIds = new Set(
    estado.membros
      .filter((m) => m.usuarioId === usuarioId)
      .map((m) => m.organizacaoId),
  );
  return (
    estado.repositorios.find(
      (r) =>
        r.escopo.tipo === "organizacao" && orgIds.has(r.escopo.organizacaoId),
    ) ??
    estado.repositorios.find(
      (r) => r.escopo.tipo === "pessoal" && r.escopo.usuarioId === usuarioId,
    ) ??
    null
  );
}

export function reducer(
  estado: EstadoPrototipo,
  acao: AcaoPrototipo,
): EstadoPrototipo {
  switch (acao.tipo) {
    /**
     * Tela 1. Cria SÓ o usuário e a sessão. A primeira organização nasce na
     * etapa seguinte (`organizacao/configurar`) — pessoal ou corporativo.
     */
    case "conta/criar": {
      const email = acao.payload.email.trim();
      const existente = estado.usuarios.find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      );

      // E-mail é o ID da conta: não recria nem sobrescreve se já existir.
      if (existente) return estado;

      const usuarioId = novoId("u");
      const criadoEm = agora();

      return {
        ...estado,
        usuarios: [
          ...estado.usuarios,
          {
            id: usuarioId,
            nome: acao.payload.nome,
            email,
            senha: acao.payload.senha,
            criadoEm,
          },
        ],
        sessao: { usuarioId },
        contexto: null,
        demo: { papelForcado: null },
      };
    }

    /**
     * Tela 2. Cria pagador + organização + membership do criador e o primeiro
     * repositório da organização, já abrindo-o.
     *
     * No cadastro (primeira organização da conta) remove o "Meu repositório"
     * pessoal residual do Step 1 antigo. Pelo perfil, a nova organização é
     * acrescentada — as existentes permanecem.
     *
     * O criador é admin AUTOMATICAMENTE — não é uma escolha oferecida a ele.
     */
    case "organizacao/configurar": {
      const sessao = estado.sessao;
      invariant(sessao, "[protótipo/contas] Configurar organização sem sessão.");

      const pagadorId = novoId("pag");
      const orgId = novoId("org");
      const membroId = novoId("mb");
      const repoId = novoId("rep");
      const criadoEm = agora();

      // Convites entram na MESMA transação da criação — e só se a regra de
      // cobrança permitir. Uma organização de pagador pessoa física tem um
      // único usuário, então e-mails digitados ali são descartados de propósito.
      const convites = podeConvidar(acao.payload.pagador)
        ? (acao.payload.emails ?? [])
            .map((e) => e.trim())
            .filter((e) => e !== "")
            .map((email) => ({
              id: novoId("cv"),
              organizacaoId: orgId,
              email,
              papel: "usuario" as const,
              status: "pendente" as const,
              criadoEm,
            }))
        : [];

      const jaTemOrganizacao = estado.membros.some(
        (m) => m.usuarioId === sessao.usuarioId,
      );

      let repositoriosBase = estado.repositorios;
      let conteudoBase = estado.conteudo;
      if (!jaTemOrganizacao) {
        const reposPessoaisAntigos = new Set(
          estado.repositorios
            .filter(
              (r) =>
                r.escopo.tipo === "pessoal" &&
                r.escopo.usuarioId === sessao.usuarioId,
            )
            .map((r) => r.id),
        );
        repositoriosBase = estado.repositorios.filter(
          (r) => !reposPessoaisAntigos.has(r.id),
        );
        conteudoBase = { ...estado.conteudo };
        for (const id of reposPessoaisAntigos) {
          delete conteudoBase[id];
        }
      }

      return {
        ...estado,
        pagadores: [
          ...estado.pagadores,
          { id: pagadorId, ...acao.payload.pagador },
        ],
        organizacoes: [
          ...estado.organizacoes,
          { id: orgId, nome: acao.payload.nome, pagadorId, criadoEm },
        ],
        membros: [
          ...estado.membros,
          {
            id: membroId,
            usuarioId: sessao.usuarioId,
            organizacaoId: orgId,
            papel: "admin",
            criadoEm,
          },
        ],
        repositorios: [
          ...repositoriosBase,
          {
            id: repoId,
            nome: `${acao.payload.nome} — geral`,
            escopo: { tipo: "organizacao", organizacaoId: orgId },
            criadoEm,
          },
        ],
        conteudo: { ...conteudoBase, [repoId]: conteudoVazio() },
        convites: [...estado.convites, ...convites],
        contexto: { repositorioId: repoId },
        demo: { papelForcado: null },
      };
    }

    case "repositorio/criar": {
      const sessao = estado.sessao;
      if (!sessao) return estado;

      const nome = acao.payload.nome.trim();
      if (nome === "") return estado;

      const ativo = estado.contexto
        ? estado.repositorios.find((r) => r.id === estado.contexto!.repositorioId)
        : null;
      const base =
        ativo ?? primeiroRepositorioDoUsuario(estado, sessao.usuarioId);
      if (!base) return estado;

      const repoId = novoId("rep");
      const criadoEm = agora();

      return {
        ...estado,
        repositorios: [
          ...estado.repositorios,
          {
            id: repoId,
            nome,
            escopo: base.escopo,
            criadoEm,
          },
        ],
        conteudo: { ...estado.conteudo, [repoId]: conteudoVazio() },
        contexto: { repositorioId: repoId },
        demo: { papelForcado: null },
      };
    }

    /**
     * Convite. O reducer VERIFICA a regra de cobrança: organização com pagador
     * pessoa física (b2c) tem um único usuário e não convida ninguém.
     */
    case "organizacao/convidar": {
      const org = estado.organizacoes.find(
        (o) => o.id === acao.payload.organizacaoId,
      );
      invariant(org, "[protótipo/contas] Organização inexistente.");
      const pagador = estado.pagadores.find((p) => p.id === org.pagadorId);
      invariant(pagador, "[protótipo/contas] Organização sem pagador.");
      invariant(
        podeConvidar(pagador),
        "[protótipo/contas] Convite recusado: organização com pagador pessoa " +
          "física tem um único usuário, que já é admin.",
      );

      const jaConvidados = new Set(
        estado.convites
          .filter((c) => c.organizacaoId === org.id)
          .map((c) => c.email.toLowerCase()),
      );
      const criadoEm = agora();
      const novos = acao.payload.emails
        .map((e) => e.trim())
        .filter((e) => e !== "" && !jaConvidados.has(e.toLowerCase()))
        .map((email) => ({
          id: novoId("cv"),
          organizacaoId: org.id,
          email,
          papel: "usuario" as const,
          status: "pendente" as const,
          criadoEm,
        }));

      return { ...estado, convites: [...estado.convites, ...novos] };
    }

    case "organizacao/alterarPapel": {
      return {
        ...estado,
        membros: estado.membros.map((m) =>
          m.id === acao.payload.membroId ? { ...m, papel: acao.payload.papel } : m,
        ),
      };
    }

    /**
     * Remove a organização e tudo que depende dela: membros, repositórios,
     * conteúdo, convites e o pagador exclusivo. Se o contexto ativo era dessa
     * org, abre a próxima organização acessível da sessão.
     */
    case "organizacao/excluir": {
      const sessao = estado.sessao;
      invariant(sessao, "[protótipo/contas] Excluir organização sem sessão.");

      const { organizacaoId } = acao.payload;
      const org = estado.organizacoes.find((o) => o.id === organizacaoId);
      invariant(org, "[protótipo/contas] Organização inexistente.");

      const membro = estado.membros.find(
        (m) =>
          m.usuarioId === sessao.usuarioId &&
          m.organizacaoId === organizacaoId,
      );
      invariant(
        membro?.papel === "admin",
        "[protótipo/contas] Só o admin pode excluir a organização.",
      );

      const repoIds = new Set(
        estado.repositorios
          .filter(
            (r) =>
              r.escopo.tipo === "organizacao" &&
              r.escopo.organizacaoId === organizacaoId,
          )
          .map((r) => r.id),
      );

      const conteudo = { ...estado.conteudo };
      for (const id of repoIds) delete conteudo[id];

      const pagadorAindaUsado = estado.organizacoes.some(
        (o) => o.id !== organizacaoId && o.pagadorId === org.pagadorId,
      );

      const proximo: EstadoPrototipo = {
        ...estado,
        organizacoes: estado.organizacoes.filter((o) => o.id !== organizacaoId),
        pagadores: pagadorAindaUsado
          ? estado.pagadores
          : estado.pagadores.filter((p) => p.id !== org.pagadorId),
        membros: estado.membros.filter(
          (m) => m.organizacaoId !== organizacaoId,
        ),
        repositorios: estado.repositorios.filter((r) => !repoIds.has(r.id)),
        conteudo,
        convites: estado.convites.filter(
          (c) => c.organizacaoId !== organizacaoId,
        ),
        demo: { papelForcado: null },
      };

      const contextoAtivoEraDesta =
        estado.contexto !== null && repoIds.has(estado.contexto.repositorioId);

      if (!contextoAtivoEraDesta) {
        return proximo;
      }

      const primeiro = primeiroRepositorioDoUsuario(proximo, sessao.usuarioId);
      return {
        ...proximo,
        contexto: primeiro ? { repositorioId: primeiro.id } : null,
      };
    }

    /**
     * Login da aplicação (`/login`). Só entra se o e-mail existir — sem
     * fallback para outro usuário (isso fazia a tela de contextos mostrar a
     * conta errada). A senha é validada antes, em `autenticar`.
     */
    case "sessao/login": {
      const alvo = estado.usuarios.find(
        (u) =>
          u.email.toLowerCase() === acao.payload.email.trim().toLowerCase(),
      );
      if (!alvo) return estado;

      const primeiro = primeiroRepositorioDoUsuario(estado, alvo.id);

      return {
        ...estado,
        sessao: { usuarioId: alvo.id },
        contexto: primeiro ? { repositorioId: primeiro.id } : null,
        demo: { papelForcado: null },
      };
    }

    case "sessao/sincronizarSenha": {
      const email = acao.payload.email.trim().toLowerCase();
      const senha = acao.payload.senha;
      if (email === "" || senha === "") return estado;
      const alvo = estado.usuarios.find(
        (u) => u.email.toLowerCase() === email,
      );
      if (!alvo || alvo.senha === senha) return estado;
      return {
        ...estado,
        usuarios: estado.usuarios.map((u) =>
          u.id === alvo.id ? { ...u, senha } : u,
        ),
      };
    }

    case "sessao/garantir": {
      const email = acao.payload.email.trim();
      if (email === "") return estado;

      const existente = estado.usuarios.find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      );
      if (existente) {
        const senhaCerta = ehContaDoTime(email)
          ? DEMO_LOGIN.senha
          : existente.senha;
        const usuarios =
          existente.senha === senhaCerta
            ? estado.usuarios
            : estado.usuarios.map((u) =>
                u.id === existente.id ? { ...u, senha: senhaCerta } : u,
              );
        if (
          estado.sessao?.usuarioId === existente.id &&
          usuarios === estado.usuarios
        ) {
          return estado;
        }
        const primeiro = primeiroRepositorioDoUsuario(estado, existente.id);
        return {
          ...estado,
          usuarios,
          sessao: { usuarioId: existente.id },
          contexto: primeiro ? { repositorioId: primeiro.id } : null,
          demo: { papelForcado: null },
        };
      }

      const usuarioId = novoId("u");
      const repoPessoalId = novoId("rep");
      const criadoEm = agora();

      // Nenhuma membership automática: uma conta nova entra SÓ com o escopo
      // pessoal. Herdar a primeira organização existente fazia a conta nova ver
      // as organizações de contas criadas antes — organizações são de quem as
      // criou ou de quem foi convidado, nunca de quem apenas chegou depois.
      return {
        ...estado,
        usuarios: [
          ...estado.usuarios,
          {
            id: usuarioId,
            nome: acao.payload.nome,
            email,
            // Sessão já autenticada: não há senha digitada. A conta do time
            // precisa da senha real; as demais usam o placeholder local.
            senha: senhaPlaceholder(email),
            criadoEm,
          },
        ],
        repositorios: [
          ...estado.repositorios,
          {
            id: repoPessoalId,
            nome: "Meu repositório",
            escopo: { tipo: "pessoal", usuarioId },
            criadoEm,
          },
        ],
        conteudo: { ...estado.conteudo, [repoPessoalId]: conteudoVazio() },
        sessao: { usuarioId },
        contexto: { repositorioId: repoPessoalId },
        demo: { papelForcado: null },
      };
    }

    // Idempotente: sair quando já não há sessão devolve o mesmo estado, para
    // não gerar render nem gravação em `localStorage` à toa.
    case "sessao/logout":
      if (
        estado.sessao === null &&
        estado.contexto === null &&
        estado.demo.papelForcado === null
      ) {
        return estado;
      }
      return { ...estado, sessao: null, contexto: null, demo: { papelForcado: null } };

    /**
     * Troca de repositório: SUBSTITUI o contexto (nunca dois abertos) e limpa o
     * papel forçado — um papel forçado de outra organização não faz sentido num
     * escopo novo.
     */
    case "contexto/abrirRepositorio":
      return {
        ...estado,
        contexto: { repositorioId: acao.payload.repositorioId },
        demo: { papelForcado: null },
      };

    case "contexto/abrirOrganizacao": {
      const sessao = estado.sessao;
      if (!sessao) return estado;

      const { organizacaoId } = acao.payload;
      const primeiro = estado.repositorios.find((r) =>
        organizacaoId === null
          ? r.escopo.tipo === "pessoal" &&
            r.escopo.usuarioId === sessao.usuarioId
          : r.escopo.tipo === "organizacao" &&
            r.escopo.organizacaoId === organizacaoId,
      );

      return {
        ...estado,
        contexto: primeiro ? { repositorioId: primeiro.id } : null,
        demo: { papelForcado: null },
      };
    }

    case "demo/forcarPapel":
      return { ...estado, demo: { papelForcado: acao.payload.papel } };

    case "prototipo/reiniciar":
      return estadoSemeado();

    default:
      return estado;
  }
}
