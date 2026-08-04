import type { PlanoCode } from "@/app/data/planos";
import type { ModuloCode } from "@/app/data/modulos";

/**
 * Contrato da camada de cobrança.
 *
 * O app NUNCA fala com o gateway (Iugu) diretamente — ele depende apenas desta
 * interface. Hoje a implementação é `MockBilling` (localStorage, pagamento
 * simulado). Na Fase 2, criamos `IuguBilling` implementando este mesmo contrato.
 *
 * Modelo de cobrança: preço unitário (por usuário ou posição, conforme o
 * módulo) × quantidade. Os preços vêm da tabela em `@/app/data/precificacao`.
 */

export type CicloCobranca = "mensal" | "anual";

export type StatusAssinatura =
  | "trial"
  | "ativa"
  | "inadimplente"
  | "expirada"
  | "cancelada";

export type MetodoPagamento = "pix" | "cartao" | "boleto";

export interface Assinatura {
  id: string;
  empresaId: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  /** Módulos contratados. */
  modulos: ModuloCode[];
  status: StatusAssinatura;
  /** Nº de usuários (módulos por usuário). 0 se não houver. */
  usuarios: number;
  /** Nº de posições (Hiring). 0 se não houver. */
  posicoes: number;
  /** Preço por usuário/mês (snapshot). */
  precoUsuario: number;
  /** Preço por posição/mês (snapshot). */
  precoPosicao: number;
  /** Total estimado/mês = usuários×precoUsuario + posições×precoPosicao. */
  total: number;
  /** Preço a definir (Corporativo / faixa sem tabela). */
  sobConsulta: boolean;
  trialStartsAt: string; // ISO
  trialEndsAt: string; // ISO
  criadoEm: string; // ISO
  ativadaEm?: string | null; // ISO
  metodoPagamento?: MetodoPagamento | null;
  /** Referência do objeto no gateway (Iugu). Sempre null no mock. */
  gatewayRef?: string | null;
}

export interface CriarTrialInput {
  empresaId: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  modulos: ModuloCode[];
  usuarios: number;
  posicoes: number;
}

export interface AtivarAssinaturaInput {
  empresaId: string;
  plano: PlanoCode;
  ciclo: CicloCobranca;
  metodoPagamento: MetodoPagamento;
}

export interface BillingService {
  /** Cria a assinatura em estado de trial (sem cobrança). */
  criarTrial(input: CriarTrialInput): Promise<Assinatura>;
  /** Retorna a assinatura da empresa, ou null. */
  obterAssinatura(empresaId: string): Promise<Assinatura | null>;
  /** Simula o checkout e ativa a assinatura (pronto p/ trocar pela Iugu). */
  ativarAssinatura(input: AtivarAssinaturaInput): Promise<Assinatura>;
  /** Cancela a assinatura. */
  cancelar(empresaId: string): Promise<void>;
}
