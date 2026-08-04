import axios from "@/utils/axios";
import type { Assinatura } from "@/services/billing";
import type {
  CadastroEmpresaInput,
  Convite,
  Empresa,
  UserRole,
  Usuario,
} from "@/app/contexts/companies/context";

/**
 * Cliente da API de empresas/tenant (backend ts/api).
 *
 * Espelha os endpoints documentados em ts/api/README.md. O JWT é injetado
 * automaticamente pelo axios (utils/jwt.ts → setSession).
 */

export interface CadastroApiResposta {
  empresa: Empresa;
  usuario: Usuario;
  assinatura: Assinatura;
  authToken: string;
}

/** POST /cadastro → cria empresa + owner + trial. */
export async function cadastrarEmpresaApi(
  input: CadastroEmpresaInput,
): Promise<CadastroApiResposta> {
  const { data } = await axios.post<CadastroApiResposta>("/cadastro", input);
  return data;
}

/** GET /cadastro/email-disponivel?email= → e-mail livre? */
export async function emailDisponivelApi(email: string): Promise<boolean> {
  const { data } = await axios.get<{ disponivel: boolean }>(
    "/cadastro/email-disponivel",
    { params: { email } },
  );
  return data.disponivel;
}

/** POST /empresa/convites → cria convites no tenant logado. */
export async function convidarUsuariosApi(
  emails: string[],
  role: UserRole = "membro",
): Promise<Convite[]> {
  const { data } = await axios.post<Convite[]>("/empresa/convites", {
    emails,
    role,
  });
  return data;
}

/** DELETE /empresa/convites/:id */
export async function removerConviteApi(id: string): Promise<void> {
  await axios.delete(`/empresa/convites/${id}`);
}

/** POST /empresa/onboarding/concluir */
export async function concluirOnboardingApi(): Promise<void> {
  await axios.post("/empresa/onboarding/concluir");
}
