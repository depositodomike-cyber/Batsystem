import { User } from "@/@types/user";
import { createSafeContext } from "@/utils/createSafeContext";

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  errorMessage: string | null;
  user: User | null;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Reidrata a sessão a partir do JWT já armazenado (ex.: após o cadastro, que
   * já devolve um token). Busca o perfil e marca como autenticado.
   */
  refreshSession: () => Promise<void>;
  /**
   * Entra na app já autenticado a partir de um usuário conhecido (protótipo de
   * contas / fluxo de demonstração). Não chama a API de login — só use quando
   * o backend estiver indisponível.
   */
  establishSession: (user: User) => void;
  /**
   * Adota um JWT real do backend (login ou `/registrar`). Preferível a
   * `establishSession` sempre que a API responder.
   */
  adoptSession: (authToken: string, user: User) => void;
}

export const [AuthProvider, useAuthContext] =
  createSafeContext<AuthContextType>(
    "useAuthContext must be used within AuthProvider",
  );
