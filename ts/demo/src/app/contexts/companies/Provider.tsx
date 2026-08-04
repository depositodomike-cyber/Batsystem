import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { setSession } from "@/utils/jwt";
import {
  cadastrarEmpresaApi,
  concluirOnboardingApi,
  convidarUsuariosApi,
  removerConviteApi,
} from "@/services/api/companies";
import {
  CompaniesContext,
  type CadastroEmpresaInput,
  type CadastroResultado,
  type CompaniesContextValue,
  type Convite,
  type Empresa,
  type UserRole,
  type Usuario,
} from "./context";

const STORAGE_KEY = "beculture:companies";
const SESSAO_KEY = "beculture:sessao";

interface PersistedState {
  empresas: Empresa[];
  usuarios: Usuario[];
  convites: Convite[];
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { empresas: [], usuarios: [], convites: [] };
    const parsed = JSON.parse(raw);
    return {
      empresas: Array.isArray(parsed?.empresas) ? parsed.empresas : [],
      usuarios: Array.isArray(parsed?.usuarios) ? parsed.usuarios : [],
      convites: Array.isArray(parsed?.convites) ? parsed.convites : [],
    };
  } catch {
    return { empresas: [], usuarios: [], convites: [] };
  }
}

function loadSessao(): string | null {
  try {
    return localStorage.getItem(SESSAO_KEY) || null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);
  const [usuarioAtualId, setUsuarioAtualId] = useState<string | null>(
    loadSessao,
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignora falhas de persistência */
    }
  }, [state]);

  useEffect(() => {
    try {
      if (usuarioAtualId) localStorage.setItem(SESSAO_KEY, usuarioAtualId);
      else localStorage.removeItem(SESSAO_KEY);
    } catch {
      /* ignora falhas de persistência */
    }
  }, [usuarioAtualId]);

  const getEmpresa = useCallback(
    (id: string) => state.empresas.find((e) => e.id === id),
    [state.empresas],
  );

  const getUsuario = useCallback(
    (id: string) => state.usuarios.find((u) => u.id === id),
    [state.usuarios],
  );

  const emailJaCadastrado = useCallback(
    (email: string) =>
      state.usuarios.some(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      ),
    [state.usuarios],
  );

  const cadastrarEmpresa = useCallback(
    async (input: CadastroEmpresaInput): Promise<CadastroResultado> => {
      // Backend cria empresa + owner + trial numa transação e devolve o JWT.
      const { empresa, usuario, assinatura, authToken } =
        await cadastrarEmpresaApi(input);

      // Autentica a sessão recém-criada (token no localStorage + header axios).
      setSession(authToken);

      // Espelha no estado local para os acessores síncronos do contexto.
      setState((prev) => ({
        ...prev,
        empresas: [...prev.empresas, empresa],
        usuarios: [...prev.usuarios, usuario],
      }));
      setUsuarioAtualId(usuario.id);

      return { empresa, usuario, assinatura };
    },
    [],
  );

  const definirSessao = useCallback(
    (id: string | null) => setUsuarioAtualId(id),
    [],
  );

  const atualizarEmpresa = useCallback<
    CompaniesContextValue["atualizarEmpresa"]
  >((id, patch) => {
    setState((prev) => ({
      ...prev,
      empresas: prev.empresas.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }));
  }, []);

  const convitesDaEmpresa = useCallback(
    (empresaId: string) =>
      state.convites.filter((c) => c.empresaId === empresaId),
    [state.convites],
  );

  const convidarUsuarios = useCallback(
    (empresaId: string, emails: string[], role: UserRole = "membro") => {
      const existentes = new Set(
        state.convites
          .filter((c) => c.empresaId === empresaId)
          .map((c) => c.email.toLowerCase()),
      );
      const owners = new Set(
        state.usuarios
          .filter((u) => u.empresaId === empresaId)
          .map((u) => u.email.toLowerCase()),
      );

      const now = new Date().toISOString();
      const novos: Convite[] = [];
      for (const raw of emails) {
        const email = raw.trim();
        const key = email.toLowerCase();
        if (!EMAIL_RE.test(email)) continue;
        if (existentes.has(key) || owners.has(key)) continue;
        existentes.add(key);
        novos.push({
          id: createId("inv"),
          empresaId,
          email,
          role,
          status: "pendente",
          criadoEm: now,
        });
      }

      if (novos.length) {
        setState((prev) => ({
          ...prev,
          convites: [...prev.convites, ...novos],
        }));
        // Persiste no backend e reconcilia os ids locais (otimistas) com os do
        // servidor, casando por e-mail — assim o "remover" funciona contra a API.
        void convidarUsuariosApi(
          novos.map((c) => c.email),
          role,
        )
          .then((salvos) => {
            const byEmail = new Map(
              salvos.map((s) => [s.email.toLowerCase(), s]),
            );
            setState((prev) => ({
              ...prev,
              convites: prev.convites.map(
                (c) => byEmail.get(c.email.toLowerCase()) ?? c,
              ),
            }));
          })
          .catch(() => {
            /* best-effort: mantém o convite otimista localmente */
          });
      }
      return novos;
    },
    [state.convites, state.usuarios],
  );

  const removerConvite = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      convites: prev.convites.filter((c) => c.id !== id),
    }));
    void removerConviteApi(id).catch(() => {
      /* best-effort */
    });
  }, []);

  const concluirOnboarding = useCallback((empresaId: string) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      empresas: prev.empresas.map((e) =>
        e.id === empresaId ? { ...e, onboardingConcluidoEm: now } : e,
      ),
    }));
    void concluirOnboardingApi().catch(() => {
      /* best-effort */
    });
  }, []);

  const usuarioAtual = useMemo(
    () => state.usuarios.find((u) => u.id === usuarioAtualId) ?? null,
    [state.usuarios, usuarioAtualId],
  );

  const empresaAtual = useMemo(
    () =>
      usuarioAtual
        ? (state.empresas.find((e) => e.id === usuarioAtual.empresaId) ?? null)
        : null,
    [state.empresas, usuarioAtual],
  );

  const value = useMemo<CompaniesContextValue>(
    () => ({
      empresas: state.empresas,
      usuarios: state.usuarios,
      convites: state.convites,
      getEmpresa,
      getUsuario,
      emailJaCadastrado,
      cadastrarEmpresa,
      usuarioAtual,
      empresaAtual,
      definirSessao,
      atualizarEmpresa,
      convitesDaEmpresa,
      convidarUsuarios,
      removerConvite,
      concluirOnboarding,
    }),
    [
      state.empresas,
      state.usuarios,
      state.convites,
      getEmpresa,
      getUsuario,
      emailJaCadastrado,
      cadastrarEmpresa,
      usuarioAtual,
      empresaAtual,
      definirSessao,
      atualizarEmpresa,
      convitesDaEmpresa,
      convidarUsuarios,
      removerConvite,
      concluirOnboarding,
    ],
  );

  return <CompaniesContext value={value}>{children}</CompaniesContext>;
}
