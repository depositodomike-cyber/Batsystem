import { createSafeContext } from "@/utils/createSafeContext";
import type { PlanoCode } from "@/app/data/planos";
import type { ModuloCode } from "@/app/data/modulos";
import type { Assinatura, CicloCobranca } from "@/services/billing";

/**
 * Modelo multi-tenant (demo).
 *
 * - Empresa = o tenant que contrata (identidade + plano escolhido).
 * - Usuário = quem faz login; o TRIAL é contado por usuário (14 dias).
 * - A cobrança/assinatura vive na camada de billing (por usuário).
 *
 * Tudo persistido em localStorage; modelado já como multi-tenant para a Fase 2
 * (backend + banco) ser uma troca de implementação, não um redesenho.
 */

export type UserRole = "owner" | "admin" | "membro";

export type TipoPessoa = "pj" | "pf";

export interface Empresa {
  id: string;
  /** "pj" = empresa (CNPJ) · "pf" = pessoa física (CPF, uso individual). */
  tipoPessoa: TipoPessoa;
  /** CNPJ (PJ) ou CPF (PF), com máscara. */
  documento: string;
  /** Razão social (PJ) ou nome do titular (PF). */
  razaoSocial: string;
  nomeFantasia?: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  /** Módulos contratados no cadastro (códigos de @/app/data/modulos). */
  modulos: ModuloCode[];
  /** Setor de atuação (definido no onboarding). Código de @/app/data/setores. */
  setor?: string;
  /** Momento em que o onboarding foi concluído (ausente = pendente). */
  onboardingConcluidoEm?: string; // ISO
  criadoEm: string; // ISO
}

export interface Usuario {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  telefone?: string;
  role: UserRole;
  trialStartsAt: string; // ISO
  trialEndsAt: string; // ISO
  criadoEm: string; // ISO
}

export type ConviteStatus = "pendente" | "aceito";

/** Convite de um membro do time, criado no onboarding (cobrança simulada). */
export interface Convite {
  id: string;
  empresaId: string;
  email: string;
  role: UserRole;
  status: ConviteStatus;
  criadoEm: string; // ISO
}

/** Configuração de contratação de um módulo (plano/quantidade próprios). */
export interface ConfigModuloContratado {
  modulo: ModuloCode;
  plano: PlanoCode;
  /** Usuários (módulos por usuário) ou posições (Hiring). */
  quantidade: number;
}

export interface CadastroEmpresaInput {
  tipoPessoa: TipoPessoa;
  documento: string;
  razaoSocial: string;
  nomeFantasia?: string;
  /** Setor de atuação (código de @/app/data/setores). */
  setor?: string;
  /** Plano "principal" (o mais alto entre os módulos) — agregado legado. */
  plano: PlanoCode;
  ciclo: CicloCobranca;
  /** Módulos contratados (códigos de @/app/data/modulos). */
  modulos: ModuloCode[];
  /** Plano e quantidade por módulo (modelo da calculadora). */
  configuracoes?: ConfigModuloContratado[];
  /** Nº de usuários (maior quantidade entre módulos por usuário) — agregado. */
  usuarios: number;
  /** Nº de posições (Hiring). */
  posicoes: number;
  responsavel: {
    nome: string;
    email: string;
    telefone: string;
    /** Senha trafega no cadastro mas NÃO é persistida na camada demo. */
    senha: string;
  };
}

export interface CadastroResultado {
  empresa: Empresa;
  usuario: Usuario;
  assinatura: Assinatura;
}

export interface CompaniesContextValue {
  empresas: Empresa[];
  usuarios: Usuario[];
  convites: Convite[];
  getEmpresa: (id: string) => Empresa | undefined;
  getUsuario: (id: string) => Usuario | undefined;
  emailJaCadastrado: (email: string) => boolean;
  /**
   * Cria a empresa + usuário owner em trial e dispara a assinatura de trial na
   * camada de billing. Lança erro se o e-mail já existir. Define a sessão atual
   * para o owner recém-criado.
   */
  cadastrarEmpresa: (input: CadastroEmpresaInput) => Promise<CadastroResultado>;

  /** Sessão atual (quem acabou de se cadastrar / está logado na demo). */
  usuarioAtual: Usuario | null;
  empresaAtual: Empresa | null;
  /** Define manualmente a sessão (ex.: login futuro). */
  definirSessao: (usuarioId: string | null) => void;

  /** Atualiza campos editáveis da empresa (setor, nome fantasia). */
  atualizarEmpresa: (
    id: string,
    patch: Partial<Pick<Empresa, "setor" | "nomeFantasia" | "razaoSocial">>,
  ) => void;

  /** Convites de um tenant. */
  convitesDaEmpresa: (empresaId: string) => Convite[];
  /** Cria convites para os e-mails informados (ignora duplicados/inválidos). */
  convidarUsuarios: (
    empresaId: string,
    emails: string[],
    role?: UserRole,
  ) => Convite[];
  removerConvite: (id: string) => void;

  /** Marca o onboarding da empresa como concluído. */
  concluirOnboarding: (empresaId: string) => void;
}

export const [CompaniesContext, useCompaniesContext] =
  createSafeContext<CompaniesContextValue>(
    "useCompaniesContext must be used within CompaniesProvider",
  );
