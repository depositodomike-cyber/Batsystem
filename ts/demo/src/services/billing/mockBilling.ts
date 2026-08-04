import { TRIAL_DIAS } from "@/app/data/planos";
import { calcularPreco } from "@/app/data/precificacao";
import type {
  Assinatura,
  AtivarAssinaturaInput,
  BillingService,
  CriarTrialInput,
} from "./types";

/**
 * Implementação de demonstração da camada de cobrança.
 *
 * Persiste as assinaturas em localStorage e SIMULA o checkout (nenhuma cobrança
 * real acontece). É o ponto exato onde, na Fase 2, entra a `IuguBilling`.
 */

const STORAGE_KEY = "beculture:billing";

function loadAll(): Record<string, Assinatura> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, Assinatura>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignora falhas de persistência */
  }
}

function createId(): string {
  return `sub_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export const mockBilling: BillingService = {
  async criarTrial({
    empresaId,
    plano,
    ciclo,
    modulos,
    usuarios,
    posicoes,
  }: CriarTrialInput): Promise<Assinatura> {
    const all = loadAll();
    const now = new Date();
    const ends = new Date(now);
    ends.setDate(ends.getDate() + TRIAL_DIAS);

    const preco = calcularPreco({
      modulos,
      plano,
      contrato: ciclo,
      usuarios,
      posicoes,
    });

    const assinatura: Assinatura = {
      id: createId(),
      empresaId,
      plano,
      ciclo,
      modulos,
      status: "trial",
      usuarios: preco.usuarios.quantidade,
      posicoes: preco.posicoes.quantidade,
      precoUsuario: preco.usuarios.unitario,
      precoPosicao: preco.posicoes.unitario,
      total: preco.total,
      sobConsulta: preco.sobConsulta,
      trialStartsAt: now.toISOString(),
      trialEndsAt: ends.toISOString(),
      criadoEm: now.toISOString(),
      ativadaEm: null,
      metodoPagamento: null,
      gatewayRef: null,
    };

    all[empresaId] = assinatura;
    saveAll(all);
    return assinatura;
  },

  async obterAssinatura(empresaId: string): Promise<Assinatura | null> {
    return loadAll()[empresaId] ?? null;
  },

  async ativarAssinatura({
    empresaId,
    plano,
    ciclo,
    metodoPagamento,
  }: AtivarAssinaturaInput): Promise<Assinatura> {
    const all = loadAll();
    const existente = all[empresaId];
    if (!existente) {
      throw new Error("Assinatura não encontrada para esta empresa.");
    }

    // Recalcula com os módulos/quantidades já contratados e o (novo) plano/ciclo.
    const preco = calcularPreco({
      modulos: existente.modulos,
      plano,
      contrato: ciclo,
      usuarios: existente.usuarios,
      posicoes: existente.posicoes,
    });

    const atualizada: Assinatura = {
      ...existente,
      plano,
      ciclo,
      status: "ativa",
      precoUsuario: preco.usuarios.unitario,
      precoPosicao: preco.posicoes.unitario,
      total: preco.total,
      sobConsulta: preco.sobConsulta,
      ativadaEm: new Date().toISOString(),
      metodoPagamento,
      gatewayRef: null,
    };

    all[empresaId] = atualizada;
    saveAll(all);
    return atualizada;
  },

  async cancelar(empresaId: string): Promise<void> {
    const all = loadAll();
    const existente = all[empresaId];
    if (!existente) return;
    all[empresaId] = { ...existente, status: "cancelada" };
    saveAll(all);
  },
};
