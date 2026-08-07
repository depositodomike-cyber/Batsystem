/**
 * Leituras do estado do protótipo — e o lugar onde o ISOLAMENTO ENTRE
 * ORGANIZAÇÕES é garantido.
 *
 * O isolamento não é convenção nem disciplina: é estrutura. Cinco camadas:
 *
 * 1. FORMA — `contexto` é objeto-ou-null, nunca array, então "dois repositórios
 *    abertos ao mesmo tempo" é inexpressável.
 * 2. INDEXAÇÃO — `conteudo` é indexado por `repositorioId`, nunca por
 *    organização. Não existe `conteudoDaOrganizacao()`, e nenhum seletor aceita
 *    uma lista de ids: consulta cruzada não tem forma expressável.
 * 3. GUARD EM RUNTIME — `conteudoDoRepositorioAtivo()` lança se alguém pedir o
 *    conteúdo de um repositório que não é o ativo.
 * 4. LISTAGEM PARTICIONADA — `gruposDeRepositorios()` já devolve tudo separado
 *    por escopo, então nenhuma UI chega a segurar um array misto.
 * 5. PAPEL POR ESCOPO — `papelEfetivo()` só resolve `Membro` pelo par
 *    (usuarioId, organizacaoId) do escopo ATIVO. Não há caminho de um contexto
 *    pessoal, ou da Org B, até a membership da Org A.
 */

import invariant from "tiny-invariant";

import { conteudoVazio } from "./fixtures";
import { podeConvidar } from "./regras";
import type {
  ConteudoRepositorio,
  EstadoPrototipo,
  Membro,
  Organizacao,
  Pagador,
  PapelNaOrganizacao,
  Repositorio,
  UsuarioProto,
} from "./types";

// ----------------------------------------------------------------------
// Sessão e contexto

export function usuarioDaSessao(s: EstadoPrototipo): UsuarioProto | null {
  const sessao = s.sessao;
  if (!sessao) return null;
  return s.usuarios.find((u) => u.id === sessao.usuarioId) ?? null;
}

/** A conta com este e-mail, se existir. Comparação sem caixa nem espaços. */
export function usuarioPorEmail(
  s: EstadoPrototipo,
  email: string,
): UsuarioProto | null {
  const alvo = email.trim().toLowerCase();
  if (alvo === "") return null;
  return s.usuarios.find((u) => u.email.toLowerCase() === alvo) ?? null;
}

export type ResultadoAutenticacao =
  | { ok: true; usuario: UsuarioProto }
  | { ok: false; motivo: "email" | "senha" };

/**
 * Valida e-mail + senha. Distingue "conta inexistente" de "senha errada" para a
 * tela poder dizer qual dos dois campos está errado — não é segurança, é um
 * protótipo, e adivinhar qual campo corrigir atrapalha a demonstração.
 */
export function autenticar(
  s: EstadoPrototipo,
  email: string,
  senha: string,
): ResultadoAutenticacao {
  const usuario = usuarioPorEmail(s, email);
  if (!usuario) return { ok: false, motivo: "email" };
  if (usuario.senha !== senha) return { ok: false, motivo: "senha" };
  return { ok: true, usuario };
}

export function repositorioAtivo(s: EstadoPrototipo): Repositorio | null {
  const contexto = s.contexto;
  if (!contexto) return null;
  return s.repositorios.find((r) => r.id === contexto.repositorioId) ?? null;
}

/**
 * A organização do repositório ATIVO — ou null se o escopo é pessoal.
 * Único caminho de "contexto" para "organização". Não existe o inverso.
 */
export function organizacaoAtiva(s: EstadoPrototipo): Organizacao | null {
  const repo = repositorioAtivo(s);
  if (!repo) return null;
  // Local: o narrowing da união não sobreviveria dentro do closure do `find`.
  const escopo = repo.escopo;
  if (escopo.tipo !== "organizacao") return null;
  return s.organizacoes.find((o) => o.id === escopo.organizacaoId) ?? null;
}

export function pagadorDaOrganizacao(
  s: EstadoPrototipo,
  organizacaoId: string,
): Pagador | null {
  const org = s.organizacoes.find((o) => o.id === organizacaoId);
  if (!org) return null;
  return s.pagadores.find((p) => p.id === org.pagadorId) ?? null;
}

export function pagadorDaOrganizacaoAtiva(s: EstadoPrototipo): Pagador | null {
  const org = organizacaoAtiva(s);
  return org ? pagadorDaOrganizacao(s, org.id) : null;
}

// ----------------------------------------------------------------------
// Membership e papel

export function membroDe(
  s: EstadoPrototipo,
  usuarioId: string,
  organizacaoId: string,
): Membro | null {
  return (
    s.membros.find(
      (m) => m.usuarioId === usuarioId && m.organizacaoId === organizacaoId,
    ) ?? null
  );
}

export function membrosDaOrganizacao(
  s: EstadoPrototipo,
  organizacaoId: string,
): (Membro & { usuario: UsuarioProto })[] {
  return s.membros
    .filter((m) => m.organizacaoId === organizacaoId)
    .flatMap((m) => {
      const usuario = s.usuarios.find((u) => u.id === m.usuarioId);
      return usuario ? [{ ...m, usuario }] : [];
    });
}

/** Organizações às quais o usuário da sessão pertence, com o papel em cada. */
export function organizacoesDoUsuario(
  s: EstadoPrototipo,
): (Organizacao & { papel: PapelNaOrganizacao })[] {
  const usuario = usuarioDaSessao(s);
  if (!usuario) return [];
  return s.membros
    .filter((m) => m.usuarioId === usuario.id)
    .flatMap((m) => {
      const org = s.organizacoes.find((o) => o.id === m.organizacaoId);
      return org ? [{ ...org, papel: m.papel }] : [];
    });
}

/**
 * Papel REAL do usuário no escopo ativo, vindo de `Membro`. Null em escopo
 * pessoal (não há organização, logo não há papel).
 */
export function papelReal(s: EstadoPrototipo): PapelNaOrganizacao | null {
  const usuario = usuarioDaSessao(s);
  const org = organizacaoAtiva(s);
  if (!usuario || !org) return null;
  return membroDe(s, usuario.id, org.id)?.papel ?? null;
}

/**
 * Papel efetivo: o override da DEMONSTRAÇÃO tem precedência sobre o real.
 *
 * O override existe só para a apresentação poder mostrar as duas visões sem
 * trocar de organização. A demonstração honesta da regra multi-organização é
 * trocar de repositório e ver o papel mudar sozinho, via `papelReal`.
 */
export function papelEfetivo(s: EstadoPrototipo): PapelNaOrganizacao | null {
  const real = papelReal(s);
  // Em escopo pessoal não há papel para forçar.
  if (real === null) return null;
  return s.demo.papelForcado ?? real;
}

// ----------------------------------------------------------------------
// Capacidades — FUNIL ÚNICO de permissão

export interface Capacidades {
  verConfiguracoesGerais: boolean;
  gerenciarUsuarios: boolean;
  gerenciarPermissoes: boolean;
  convidar: boolean;
  escopoOrganizacional: boolean;
}

/**
 * Menu, guards de rota e páginas leem ESTA função — então não podem divergir.
 * Se um item aparece no menu, a página correspondente concorda; se some, a
 * página nega. Uma fonte, zero condicional duplicada.
 */
export function capacidades(s: EstadoPrototipo): Capacidades {
  const papel = papelEfetivo(s);
  const pagador = pagadorDaOrganizacaoAtiva(s);
  const admin = papel === "admin";

  return {
    verConfiguracoesGerais: admin,
    gerenciarUsuarios: admin,
    gerenciarPermissoes: admin,
    // Convite exige ser admin E a organização permitir (b2b).
    convidar: admin && !!pagador && podeConvidar(pagador),
    escopoOrganizacional: !!pagador,
  };
}

// ----------------------------------------------------------------------
// Repositórios — sempre particionados por escopo

export interface GrupoDeRepositorios {
  chave: string;
  rotulo: string;
  escopo: "pessoal" | "organizacao";
  /** Presente só quando `escopo === "organizacao"`. */
  papel?: PapelNaOrganizacao;
  organizacaoId?: string;
  repositorios: Repositorio[];
}

/**
 * Todos os repositórios que o usuário da sessão pode abrir, JÁ PARTICIONADOS.
 * Nenhum consumidor recebe um array misto — não há como confundir escopos.
 */
export function gruposDeRepositorios(
  s: EstadoPrototipo,
): GrupoDeRepositorios[] {
  const usuario = usuarioDaSessao(s);
  if (!usuario) return [];

  const pessoais = s.repositorios.filter(
    (r) => r.escopo.tipo === "pessoal" && r.escopo.usuarioId === usuario.id,
  );

  // Sempre há workspace pessoal — mesmo sem repositórios ainda.
  const grupos: GrupoDeRepositorios[] = [
    {
      chave: "pessoal",
      rotulo: "Workspace pessoal",
      escopo: "pessoal",
      repositorios: pessoais,
    },
  ];

  for (const org of organizacoesDoUsuario(s)) {
    grupos.push({
      chave: org.id,
      rotulo: org.nome,
      escopo: "organizacao",
      papel: org.papel,
      organizacaoId: org.id,
      repositorios: s.repositorios.filter(
        (r) =>
          r.escopo.tipo === "organizacao" && r.escopo.organizacaoId === org.id,
      ),
    });
  }

  return grupos;
}

/**
 * Repositórios (contextos) do escopo ATIVO — o workspace aberto agora, ou o
 * workspace pessoal quando o contexto é pessoal.
 */
export function repositoriosDoEscopoAtivo(s: EstadoPrototipo): Repositorio[] {
  const usuario = usuarioDaSessao(s);
  if (!usuario) return [];

  const escopo = repositorioAtivo(s)?.escopo;
  if (escopo?.tipo === "organizacao") {
    const organizacaoId = escopo.organizacaoId;
    return s.repositorios.filter(
      (r) =>
        r.escopo.tipo === "organizacao" &&
        r.escopo.organizacaoId === organizacaoId,
    );
  }

  return s.repositorios.filter(
    (r) => r.escopo.tipo === "pessoal" && r.escopo.usuarioId === usuario.id,
  );
}

/**
 * ISOLAMENTO: só o repositório ATIVO tem conteúdo legível.
 *
 * Repositórios de organizações diferentes não se falam. Se algum código futuro
 * tentar renderizar dois lado a lado, quebra alto e claro aqui em dev, em vez
 * de vazar dado de uma organização para outra em silêncio.
 */
export function conteudoDoRepositorioAtivo(
  s: EstadoPrototipo,
  repositorioId: string,
): ConteudoRepositorio {
  invariant(
    s.contexto?.repositorioId === repositorioId,
    "[protótipo/contas] Leitura de conteúdo de contexto NÃO ativo — " +
      "contextos são isolados entre organizações e só há um aberto por sessão.",
  );
  return s.conteudo[repositorioId] ?? conteudoVazio();
}

/** Rótulo do escopo do repositório ativo, para o badge de contexto. */
export function rotuloEscopoAtivo(s: EstadoPrototipo): string {
  const org = organizacaoAtiva(s);
  if (org) return org.nome;
  return repositorioAtivo(s) ? "Contexto pessoal" : "Nenhum contexto";
}

/** Convites pendentes de uma organização. */
export function convitesDaOrganizacao(
  s: EstadoPrototipo,
  organizacaoId: string,
) {
  return s.convites.filter((c) => c.organizacaoId === organizacaoId);
}
