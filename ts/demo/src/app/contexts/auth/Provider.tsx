// Import Dependencies
import { useCallback, useEffect, useMemo, useReducer, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";

// Local Imports
import axios from "@/utils/axios";
import { isTokenValid, setSession } from "@/utils/jwt";
import { PROTOTYPE_TOKEN_SUFFIX, isPrototypeToken } from "@/utils/sessaoLocal";
import { AuthProvider as AuthContext, AuthContextType } from "./context";
import { SPLASH_AFTER_LOGIN_KEY } from "@/components/template/SplashScreen";
import { User } from "@/@types/user";

// ----------------------------------------------------------------------

interface AuthAction {
  type:
    | "INITIALIZE"
    | "LOGIN_REQUEST"
    | "LOGIN_SUCCESS"
    | "LOGIN_ERROR"
    | "LOGOUT";
  payload?: Partial<AuthContextType>;
}

// Initial state
const initialState: AuthContextType = {
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  errorMessage: null,
  user: null,
  sessaoLocal: false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  establishSession: () => {},
  adoptSession: () => {},
};

// Reducer handlers
const reducerHandlers: Record<
  AuthAction["type"],
  (state: AuthContextType, action: AuthAction) => AuthContextType
> = {
  INITIALIZE: (state, action) => ({
    ...state,
    isAuthenticated: action.payload?.isAuthenticated ?? false,
    isInitialized: true,
    user: action.payload?.user ?? null,
    sessaoLocal: action.payload?.sessaoLocal ?? false,
  }),

  LOGIN_REQUEST: (state) => ({
    ...state,
    isLoading: true,
  }),

  LOGIN_SUCCESS: (state, action) => ({
    ...state,
    isAuthenticated: true,
    isLoading: false,
    user: action.payload?.user ?? null,
    sessaoLocal: action.payload?.sessaoLocal ?? false,
  }),

  LOGIN_ERROR: (state, action) => ({
    ...state,
    errorMessage: action.payload?.errorMessage ?? "An error occurred",
    isLoading: false,
  }),

  // Idempotente de propósito: sair de uma sessão que já não existe não pode
  // gerar um estado novo, senão um `logout()` em efeito de montagem (a tela de
  // criar conta faz isso) realimenta o próprio efeito.
  LOGOUT: (state) =>
    !state.isAuthenticated && state.user === null
      ? state
      : { ...state, isAuthenticated: false, user: null, sessaoLocal: false },
};

// Reducer function
const reducer = (
  state: AuthContextType,
  action: AuthAction,
): AuthContextType => {
  const handler = reducerHandlers[action.type];
  return handler ? handler(state, action) : state;
};

/** JWT mínimo com `exp` futuro — só para o AuthGuard/localStorage. */
function tokenPrototipo(user: User): string {
  const toB64Url = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return [
    toB64Url({ alg: "none", typ: "JWT" }),
    toB64Url({
      sub: user.id,
      email: user.email ?? "",
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    }),
    // Assinatura falsa — é o sufixo que `isPrototypeToken` reconhece.
    PROTOTYPE_TOKEN_SUFFIX.slice(1),
  ].join(".");
}

function userFromPrototypeToken(authToken: string): User {
  const decoded = jwtDecode<{
    sub?: string;
    email?: string;
    name?: string;
  }>(authToken);
  return {
    id: decoded.sub ?? "prototype",
    name: decoded.name ?? decoded.email?.split("@")[0] ?? "Usuário",
    email: decoded.email,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const init = async () => {
      try {
        const authToken = window.localStorage.getItem("authToken");

        if (authToken && isTokenValid(authToken)) {
          setSession(authToken);

          // Token do protótipo de contas: não há perfil na API.
          if (isPrototypeToken(authToken)) {
            dispatch({
              type: "INITIALIZE",
              payload: {
                isAuthenticated: true,
                user: userFromPrototypeToken(authToken),
                sessaoLocal: true,
              },
            });
            return;
          }

          const response = await axios.get<{ user: User }>("/user/profile");
          const { user } = response.data;

          dispatch({
            type: "INITIALIZE",
            payload: {
              isAuthenticated: true,
              user,
            },
          });
        } else {
          dispatch({
            type: "INITIALIZE",
            payload: {
              isAuthenticated: false,
              user: null,
            },
          });
        }
      } catch (err) {
        console.error(err);
        dispatch({
          type: "INITIALIZE",
          payload: {
            isAuthenticated: false,
            user: null,
          },
        });
      }
    };

    init();
  }, []);

  /*
   * As funções abaixo entram no valor do contexto, então precisam de identidade
   * estável: sem isso qualquer efeito que dependa delas (ex.: o `logout()` na
   * montagem da criação de conta) reexecuta a cada render e vira loop.
   */
  const login = useCallback(async (credentials: {
    username: string;
    password: string;
  }) => {
    dispatch({ type: "LOGIN_REQUEST" });

    try {
      const response = await axios.post<{ authToken: string; user: User }>(
        "/login",
        credentials,
      );
      const { authToken, user } = response.data;

      if (
        typeof authToken !== "string" ||
        typeof user !== "object" ||
        user === null
      ) {
        throw new Error("Response is not valid");
      }

      setSession(authToken);

      // Marca que houve um login para o Root exibir a animação de entrada.
      window.sessionStorage.setItem(SPLASH_AFTER_LOGIN_KEY, "1");

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user },
      });
    } catch (err) {
      dispatch({
        type: "LOGIN_ERROR",
        payload: {
          errorMessage: err instanceof Error ? err.message : "Login failed",
        },
      });
    }
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    window.sessionStorage.removeItem(SPLASH_AFTER_LOGIN_KEY);
    dispatch({ type: "LOGOUT" });
  }, []);

  // Reidrata a sessão a partir do JWT já armazenado (ex.: após o cadastro).
  const refreshSession = useCallback(async () => {
    const authToken = window.localStorage.getItem("authToken");
    if (!authToken || !isTokenValid(authToken)) {
      dispatch({ type: "LOGOUT" });
      return;
    }
    setSession(authToken);
    if (isPrototypeToken(authToken)) {
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user: userFromPrototypeToken(authToken), sessaoLocal: true },
      });
      return;
    }
    const response = await axios.get<{ user: User }>("/user/profile");
    dispatch({
      type: "LOGIN_SUCCESS",
      payload: { user: response.data.user },
    });
  }, []);

  const establishSession = useCallback((user: User) => {
    setSession(tokenPrototipo(user));
    window.sessionStorage.setItem(SPLASH_AFTER_LOGIN_KEY, "1");
    dispatch({
      type: "LOGIN_SUCCESS",
      payload: { user, sessaoLocal: true },
    });
  }, []);

  const adoptSession = useCallback((authToken: string, user: User) => {
    setSession(authToken);
    window.sessionStorage.setItem(SPLASH_AFTER_LOGIN_KEY, "1");
    dispatch({
      type: "LOGIN_SUCCESS",
      // Deriva do token em vez de assumir: quem adota deveria trazer um JWT
      // real, mas se vier um de protótipo o estado precisa refletir isso.
      payload: { user, sessaoLocal: isPrototypeToken(authToken) },
    });
  }, []);

  const valor = useMemo(
    () => ({
      ...state,
      login,
      logout,
      refreshSession,
      establishSession,
      adoptSession,
    }),
    [state, login, logout, refreshSession, establishSession, adoptSession],
  );

  if (!children) {
    return null;
  }

  return <AuthContext value={valor}>{children}</AuthContext>;
}
