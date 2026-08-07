import axios from "@/utils/axios";
import type { User } from "@/@types/user";

/**
 * Sincroniza contas do fluxo novo com o backend (`POST /registrar` +
 * `POST /login`). Sem isto, o front cria só no localStorage e as rotas
 * autenticadas (Regras, etc.) respondem 401.
 */

export interface RegistrarContaInput {
  nome: string;
  email: string;
  senha: string;
  workspaceNome?: string;
}

/**
 * O login só falha de verdade quando as credenciais não servem (`conflito`).
 * Servidor fora, throttle (429) ou erro interno viram `local`: a senha já foi
 * conferida no estado do protótipo, então travar a entrada seria pior do que
 * seguir sem o JWT real.
 */
export type ResultadoSessao =
  | { tipo: "ok"; authToken: string; user: User }
  | { tipo: "local"; motivo: "offline" | "ocupado" | "erro" }
  | { tipo: "conflito"; mensagem: string };

interface LoginApiResposta {
  authToken: string;
  user: User;
}

interface RegistrarApiResposta {
  authToken: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
}

function usuarioApiParaUser(u: RegistrarApiResposta["usuario"]): User {
  return {
    id: u.id,
    name: u.nome,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl ?? undefined,
  };
}

function mensagemErro(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return String(m[0]);
    if (typeof m === "string") return m;
  }
  return "";
}

function statusHttp(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const o = err as { statusCode?: number; status?: number };
  return o.statusCode ?? o.status ?? null;
}

/** POST /registrar — cria empresa + owner + trial e devolve JWT. */
export async function registrarContaApi(
  input: RegistrarContaInput,
): Promise<{ authToken: string; user: User }> {
  const { data } = await axios.post<RegistrarApiResposta>("/registrar", {
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    workspaceNome: input.workspaceNome,
  });
  return { authToken: data.authToken, user: usuarioApiParaUser(data.usuario) };
}

/** POST /login — e-mail no campo `username` (contrato do front). */
export async function loginContaApi(
  email: string,
  senha: string,
): Promise<{ authToken: string; user: User }> {
  const { data } = await axios.post<LoginApiResposta>("/login", {
    username: email,
    password: senha,
  });
  return { authToken: data.authToken, user: data.user };
}

function credenciaisInvalidas(err: unknown): boolean {
  return (
    statusHttp(err) === 401 || /e-mail ou senha inválidos/i.test(mensagemErro(err))
  );
}

function emailJaCadastrado(err: unknown): boolean {
  return statusHttp(err) === 409 || /já está cadastrado/i.test(mensagemErro(err));
}

/** 429 do throttler do Nest — acontece com poucas tentativas por minuto. */
function excedeuTentativas(err: unknown): boolean {
  return statusHttp(err) === 429 || /too many requests/i.test(mensagemErro(err));
}

function motivoLocal(err: unknown): "offline" | "ocupado" | "erro" {
  if (excedeuTentativas(err)) return "ocupado";
  // O interceptor do axios devolve "Something went wrong" quando não há
  // resposta HTTP — ou seja, servidor fora do ar.
  if (err === "Something went wrong") return "offline";
  if (/network error|econnrefused|failed to fetch/i.test(mensagemErro(err))) {
    return "offline";
  }
  return "erro";
}

/**
 * Garante uma sessão real no backend: tenta login e, se a conta não existir
 * lá, registra. Qualquer indisponibilidade devolve `local` em vez de barrar
 * a entrada.
 */
export async function garantirSessaoBackend(
  input: RegistrarContaInput,
): Promise<ResultadoSessao> {
  try {
    const sessao = await loginContaApi(input.email, input.senha);
    return { tipo: "ok", ...sessao };
  } catch (errLogin) {
    if (!credenciaisInvalidas(errLogin)) {
      return { tipo: "local", motivo: motivoLocal(errLogin) };
    }

    try {
      const sessao = await registrarContaApi(input);
      return { tipo: "ok", ...sessao };
    } catch (errReg) {
      if (emailJaCadastrado(errReg)) {
        return {
          tipo: "conflito",
          mensagem:
            "Este e-mail já tem conta no servidor com outra senha. Use a senha do servidor ou outro e-mail.",
        };
      }
      return { tipo: "local", motivo: motivoLocal(errReg) };
    }
  }
}

/** Texto curto para avisar por que a sessão ficou só neste navegador. */
export function descricaoModoLocal(
  motivo: "offline" | "ocupado" | "erro",
): string {
  if (motivo === "ocupado") {
    return "O servidor recusou novas tentativas por excesso de acessos. Suas alterações ficam neste navegador até o próximo login.";
  }
  if (motivo === "offline") {
    return "Servidor indisponível — suas alterações ficam neste navegador.";
  }
  return "O servidor respondeu com erro — suas alterações ficam neste navegador.";
}
