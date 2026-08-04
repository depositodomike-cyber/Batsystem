/**
 * Tabela de preços (gerada de Base_Preço_GregHub.xlsx) + cálculo multi-módulo.
 *
 * Preço = valor por USUÁRIO ou por POSIÇÃO, por mês, conforme o módulo.
 * Varia por: módulo × contrato (mensal/anual) × plano × faixa de quantidade.
 * O contrato anual aplica -15% sobre o mensal (preços já calculados na tabela).
 * `preco: 0` significa "sob consulta" (mecanismo mantido; sem casos hoje).
 *
 * Regra de MÚLTIPLOS módulos (módulos por usuário):
 *   preço/usuário = preço do PLANO (1×) + Básico de cada módulo adicional.
 *   Ex.: Profissional + 2 extras = Profissional + Básico + Básico (nunca 2× Profissional).
 * Hiring é por posição (unidade diferente) → tratado isoladamente, sem combinar.
 *
 * Obs.: os preços de cada módulo são padronizados (iguais entre módulos em cada
 * plano/contrato/faixa), então o módulo "âncora" do plano não altera o total.
 */

import type { PlanoCode } from "./planos";
import { MODULO_CODES, type ModuloCode } from "./modulos";

export type Contrato = "mensal" | "anual";

export interface FaixaPreco {
  modulo: ModuloCode;
  contrato: Contrato;
  plano: PlanoCode;
  min: number;
  max: number | null; // null = sem teto
  preco: number; // por usuário/posição /mês; 0 = sob consulta
}

export const TABELA_PRECOS: FaixaPreco[] = [
  { modulo: "performance", contrato: "mensal", plano: "basico", min: 1, max: 10, preco: 24.9 },
  { modulo: "learning", contrato: "mensal", plano: "basico", min: 1, max: 10, preco: 24.9 },
  { modulo: "projetos", contrato: "mensal", plano: "basico", min: 1, max: 10, preco: 24.9 },
  { modulo: "performance", contrato: "anual", plano: "basico", min: 1, max: 10, preco: 21.165 },
  { modulo: "learning", contrato: "anual", plano: "basico", min: 1, max: 10, preco: 21.165 },
  { modulo: "projetos", contrato: "anual", plano: "basico", min: 1, max: 10, preco: 21.165 },
  { modulo: "performance", contrato: "mensal", plano: "profissional", min: 1, max: 10, preco: 83.9 },
  { modulo: "learning", contrato: "mensal", plano: "profissional", min: 1, max: 10, preco: 83.9 },
  { modulo: "projetos", contrato: "mensal", plano: "profissional", min: 1, max: 10, preco: 83.9 },
  { modulo: "performance", contrato: "anual", plano: "profissional", min: 1, max: 10, preco: 71.315 },
  { modulo: "learning", contrato: "anual", plano: "profissional", min: 1, max: 10, preco: 71.315 },
  { modulo: "projetos", contrato: "anual", plano: "profissional", min: 1, max: 10, preco: 71.315 },
  { modulo: "performance", contrato: "mensal", plano: "corporativo", min: 1, max: 10, preco: 142.9 },
  { modulo: "learning", contrato: "mensal", plano: "corporativo", min: 1, max: 10, preco: 142.9 },
  { modulo: "projetos", contrato: "mensal", plano: "corporativo", min: 1, max: 10, preco: 142.9 },
  { modulo: "performance", contrato: "anual", plano: "corporativo", min: 1, max: 10, preco: 121.465 },
  { modulo: "learning", contrato: "anual", plano: "corporativo", min: 1, max: 10, preco: 121.465 },
  { modulo: "projetos", contrato: "anual", plano: "corporativo", min: 1, max: 10, preco: 121.465 },
  { modulo: "performance", contrato: "mensal", plano: "basico", min: 11, max: 25, preco: 23.7 },
  { modulo: "learning", contrato: "mensal", plano: "basico", min: 11, max: 25, preco: 23.7 },
  { modulo: "projetos", contrato: "mensal", plano: "basico", min: 11, max: 25, preco: 23.7 },
  { modulo: "performance", contrato: "anual", plano: "basico", min: 11, max: 25, preco: 20.145 },
  { modulo: "learning", contrato: "anual", plano: "basico", min: 11, max: 25, preco: 20.145 },
  { modulo: "projetos", contrato: "anual", plano: "basico", min: 11, max: 25, preco: 20.145 },
  { modulo: "performance", contrato: "mensal", plano: "profissional", min: 11, max: 25, preco: 82.7 },
  { modulo: "learning", contrato: "mensal", plano: "profissional", min: 11, max: 25, preco: 82.7 },
  { modulo: "projetos", contrato: "mensal", plano: "profissional", min: 11, max: 25, preco: 82.7 },
  { modulo: "performance", contrato: "anual", plano: "profissional", min: 11, max: 25, preco: 70.295 },
  { modulo: "learning", contrato: "anual", plano: "profissional", min: 11, max: 25, preco: 70.295 },
  { modulo: "projetos", contrato: "anual", plano: "profissional", min: 11, max: 25, preco: 70.295 },
  { modulo: "performance", contrato: "mensal", plano: "corporativo", min: 11, max: 25, preco: 141.7 },
  { modulo: "learning", contrato: "mensal", plano: "corporativo", min: 11, max: 25, preco: 141.7 },
  { modulo: "projetos", contrato: "mensal", plano: "corporativo", min: 11, max: 25, preco: 141.7 },
  { modulo: "performance", contrato: "anual", plano: "corporativo", min: 11, max: 25, preco: 120.445 },
  { modulo: "learning", contrato: "anual", plano: "corporativo", min: 11, max: 25, preco: 120.445 },
  { modulo: "projetos", contrato: "anual", plano: "corporativo", min: 11, max: 25, preco: 120.445 },
  { modulo: "performance", contrato: "mensal", plano: "basico", min: 26, max: 50, preco: 22.6 },
  { modulo: "learning", contrato: "mensal", plano: "basico", min: 26, max: 50, preco: 22.6 },
  { modulo: "projetos", contrato: "mensal", plano: "basico", min: 26, max: 50, preco: 22.6 },
  { modulo: "performance", contrato: "anual", plano: "basico", min: 26, max: 50, preco: 19.21 },
  { modulo: "learning", contrato: "anual", plano: "basico", min: 26, max: 50, preco: 19.21 },
  { modulo: "projetos", contrato: "anual", plano: "basico", min: 26, max: 50, preco: 19.21 },
  { modulo: "performance", contrato: "mensal", plano: "profissional", min: 26, max: 50, preco: 81.6 },
  { modulo: "learning", contrato: "mensal", plano: "profissional", min: 26, max: 50, preco: 81.6 },
  { modulo: "projetos", contrato: "mensal", plano: "profissional", min: 26, max: 50, preco: 81.6 },
  { modulo: "performance", contrato: "anual", plano: "profissional", min: 26, max: 50, preco: 69.36 },
  { modulo: "learning", contrato: "anual", plano: "profissional", min: 26, max: 50, preco: 69.36 },
  { modulo: "projetos", contrato: "anual", plano: "profissional", min: 26, max: 50, preco: 69.36 },
  { modulo: "performance", contrato: "mensal", plano: "corporativo", min: 26, max: 50, preco: 140.6 },
  { modulo: "learning", contrato: "mensal", plano: "corporativo", min: 26, max: 50, preco: 140.6 },
  { modulo: "projetos", contrato: "mensal", plano: "corporativo", min: 26, max: 50, preco: 140.6 },
  { modulo: "performance", contrato: "anual", plano: "corporativo", min: 26, max: 50, preco: 119.51 },
  { modulo: "learning", contrato: "anual", plano: "corporativo", min: 26, max: 50, preco: 119.51 },
  { modulo: "projetos", contrato: "anual", plano: "corporativo", min: 26, max: 50, preco: 119.51 },
  { modulo: "performance", contrato: "mensal", plano: "basico", min: 51, max: 100, preco: 21.5 },
  { modulo: "learning", contrato: "mensal", plano: "basico", min: 51, max: 100, preco: 21.5 },
  { modulo: "projetos", contrato: "mensal", plano: "basico", min: 51, max: 100, preco: 21.5 },
  { modulo: "performance", contrato: "anual", plano: "basico", min: 51, max: 100, preco: 18.275 },
  { modulo: "learning", contrato: "anual", plano: "basico", min: 51, max: 100, preco: 18.275 },
  { modulo: "projetos", contrato: "anual", plano: "basico", min: 51, max: 100, preco: 18.275 },
  { modulo: "performance", contrato: "mensal", plano: "profissional", min: 51, max: 100, preco: 80.5 },
  { modulo: "learning", contrato: "mensal", plano: "profissional", min: 51, max: 100, preco: 80.5 },
  { modulo: "projetos", contrato: "mensal", plano: "profissional", min: 51, max: 100, preco: 80.5 },
  { modulo: "performance", contrato: "anual", plano: "profissional", min: 51, max: 100, preco: 68.425 },
  { modulo: "learning", contrato: "anual", plano: "profissional", min: 51, max: 100, preco: 68.425 },
  { modulo: "projetos", contrato: "anual", plano: "profissional", min: 51, max: 100, preco: 68.425 },
  { modulo: "performance", contrato: "mensal", plano: "corporativo", min: 51, max: 100, preco: 139.5 },
  { modulo: "learning", contrato: "mensal", plano: "corporativo", min: 51, max: 100, preco: 139.5 },
  { modulo: "projetos", contrato: "mensal", plano: "corporativo", min: 51, max: 100, preco: 139.5 },
  { modulo: "performance", contrato: "anual", plano: "corporativo", min: 51, max: 100, preco: 118.575 },
  { modulo: "learning", contrato: "anual", plano: "corporativo", min: 51, max: 100, preco: 118.575 },
  { modulo: "projetos", contrato: "anual", plano: "corporativo", min: 51, max: 100, preco: 118.575 },
  { modulo: "performance", contrato: "mensal", plano: "basico", min: 101, max: null, preco: 20.5 },
  { modulo: "learning", contrato: "mensal", plano: "basico", min: 101, max: null, preco: 20.5 },
  { modulo: "projetos", contrato: "mensal", plano: "basico", min: 101, max: null, preco: 20.5 },
  { modulo: "performance", contrato: "anual", plano: "basico", min: 101, max: null, preco: 17.425 },
  { modulo: "learning", contrato: "anual", plano: "basico", min: 101, max: null, preco: 17.425 },
  { modulo: "projetos", contrato: "anual", plano: "basico", min: 101, max: null, preco: 17.425 },
  { modulo: "performance", contrato: "mensal", plano: "profissional", min: 101, max: null, preco: 79.5 },
  { modulo: "learning", contrato: "mensal", plano: "profissional", min: 101, max: null, preco: 79.5 },
  { modulo: "projetos", contrato: "mensal", plano: "profissional", min: 101, max: null, preco: 79.5 },
  { modulo: "performance", contrato: "anual", plano: "profissional", min: 101, max: null, preco: 67.575 },
  { modulo: "learning", contrato: "anual", plano: "profissional", min: 101, max: null, preco: 67.575 },
  { modulo: "projetos", contrato: "anual", plano: "profissional", min: 101, max: null, preco: 67.575 },
  { modulo: "performance", contrato: "mensal", plano: "corporativo", min: 101, max: null, preco: 138.5 },
  { modulo: "learning", contrato: "mensal", plano: "corporativo", min: 101, max: null, preco: 138.5 },
  { modulo: "projetos", contrato: "mensal", plano: "corporativo", min: 101, max: null, preco: 138.5 },
  { modulo: "performance", contrato: "anual", plano: "corporativo", min: 101, max: null, preco: 117.725 },
  { modulo: "learning", contrato: "anual", plano: "corporativo", min: 101, max: null, preco: 117.725 },
  { modulo: "projetos", contrato: "anual", plano: "corporativo", min: 101, max: null, preco: 117.725 },
  // --- Hiring (por posição): faixas 1-2, 3-4, 5-8 e 9+ (sem teto) ---
  { modulo: "recrutamento", contrato: "mensal", plano: "basico", min: 1, max: 2, preco: 249.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "basico", min: 1, max: 2, preco: 212.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "profissional", min: 1, max: 2, preco: 299.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "profissional", min: 1, max: 2, preco: 254.915 },
  { modulo: "recrutamento", contrato: "mensal", plano: "corporativo", min: 1, max: 2, preco: 349.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "corporativo", min: 1, max: 2, preco: 297.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "basico", min: 3, max: 4, preco: 239.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "basico", min: 3, max: 4, preco: 203.915 },
  { modulo: "recrutamento", contrato: "mensal", plano: "profissional", min: 3, max: 4, preco: 289.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "profissional", min: 3, max: 4, preco: 246.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "corporativo", min: 3, max: 4, preco: 339.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "corporativo", min: 3, max: 4, preco: 288.915 },
  { modulo: "recrutamento", contrato: "mensal", plano: "basico", min: 5, max: 8, preco: 229.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "basico", min: 5, max: 8, preco: 195.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "profissional", min: 5, max: 8, preco: 279.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "profissional", min: 5, max: 8, preco: 237.915 },
  { modulo: "recrutamento", contrato: "mensal", plano: "corporativo", min: 5, max: 8, preco: 329.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "corporativo", min: 5, max: 8, preco: 280.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "basico", min: 9, max: null, preco: 219.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "basico", min: 9, max: null, preco: 186.915 },
  { modulo: "recrutamento", contrato: "mensal", plano: "profissional", min: 9, max: null, preco: 269.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "profissional", min: 9, max: null, preco: 229.415 },
  { modulo: "recrutamento", contrato: "mensal", plano: "corporativo", min: 9, max: null, preco: 319.9 },
  { modulo: "recrutamento", contrato: "anual", plano: "corporativo", min: 9, max: null, preco: 271.915 },
  // --- IA (por usuário): sem plano Básico, preço único por plano/ciclo ---
  { modulo: "ia_pessoal", contrato: "mensal", plano: "profissional", min: 1, max: null, preco: 116.5 },
  { modulo: "ia_pessoal", contrato: "anual", plano: "profissional", min: 1, max: null, preco: 99.0 },
  { modulo: "ia_pessoal", contrato: "mensal", plano: "corporativo", min: 1, max: null, preco: 234.2 },
  { modulo: "ia_pessoal", contrato: "anual", plano: "corporativo", min: 1, max: null, preco: 199.0 },
];

/**
 * Módulos cobrados isolados: não participam da eleição de âncora nem do
 * desconto de pacote (Hiring por unidade própria; IA sempre no plano cheio).
 */
export const MODULOS_FIXOS: ModuloCode[] = ["recrutamento", "ia_pessoal"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ----------------------------------------------------------------
 * Cálculo por módulo (calculadora): cada módulo tem plano, ciclo e
 * quantidade próprios. Desconto de pacote mantido: entre os módulos
 * por usuário, o de MAIOR subtotal é o "âncora" (cobrado no plano
 * escolhido); os demais são cobrados no preço Básico da própria
 * faixa/ciclo. Hiring (por posição) é cobrado isolado, sem pacote.
 * ---------------------------------------------------------------- */

export interface ConfigModulo {
  modulo: ModuloCode;
  plano: PlanoCode;
  contrato: Contrato;
  /** Usuários (módulos por usuário) ou posições (Hiring). */
  quantidade: number;
}

export interface LinhaPrecoModulo {
  modulo: ModuloCode;
  plano: PlanoCode;
  contrato: Contrato;
  quantidade: number;
  /** Preço unitário efetivo (após desconto de pacote). */
  unitario: number;
  /** unitario × quantidade. */
  total: number;
  /** É o módulo âncora (cobrado no plano cheio escolhido). */
  ancora: boolean;
  /** Cobrado no Básico por ser módulo adicional de um plano superior. */
  descontoPacote: boolean;
  /** Preço a definir (ex.: Hiring + Corporativo). */
  sobConsulta: boolean;
}

export interface ResultadoPrecoPorModulo {
  linhas: LinhaPrecoModulo[];
  total: number;
  sobConsulta: boolean;
}

export function calcularPrecoPorModulo(
  configs: ConfigModulo[],
): ResultadoPrecoPorModulo {
  const porUsuario = configs.filter((c) => !MODULOS_FIXOS.includes(c.modulo));
  const fixos = configs.filter((c) => MODULOS_FIXOS.includes(c.modulo));

  // Subtotal "cheio" (no plano escolhido) de cada módulo por usuário,
  // usado só para eleger o âncora (maior subtotal).
  const cheios = porUsuario.map((c) => {
    const qn = q(c.quantidade);
    const faixa = buscarFaixa(c.modulo, c.plano, c.contrato, qn);
    const ok = !!faixa && faixa.preco > 0;
    return { c, qn, ok, unitario: ok ? faixa!.preco : 0 };
  });

  let ancoraIdx = -1;
  let melhor = -1;
  cheios.forEach((f, i) => {
    const subtotal = f.ok ? f.unitario * f.qn : -1;
    if (f.ok && subtotal > melhor) {
      melhor = subtotal;
      ancoraIdx = i;
    }
  });

  const linhas: LinhaPrecoModulo[] = [];

  cheios.forEach((f, i) => {
    const base = {
      modulo: f.c.modulo,
      plano: f.c.plano,
      contrato: f.c.contrato,
      quantidade: f.qn,
    };
    if (i === ancoraIdx) {
      linhas.push({
        ...base,
        unitario: f.unitario,
        total: round2(f.unitario * f.qn),
        ancora: true,
        descontoPacote: false,
        sobConsulta: !f.ok,
      });
    } else {
      // Módulo adicional → cobrado no Básico da própria faixa/ciclo.
      const fb = buscarFaixa(f.c.modulo, "basico", f.c.contrato, f.qn);
      const okB = !!fb && fb.preco > 0;
      const unitario = okB ? fb!.preco : 0;
      linhas.push({
        ...base,
        unitario,
        total: round2(unitario * f.qn),
        ancora: false,
        descontoPacote: okB && f.c.plano !== "basico",
        sobConsulta: !okB,
      });
    }
  });

  fixos.forEach((c) => {
    const qn = q(c.quantidade);
    const faixa = buscarFaixa(c.modulo, c.plano, c.contrato, qn);
    const sob = !faixa || faixa.preco <= 0;
    linhas.push({
      modulo: c.modulo,
      plano: c.plano,
      contrato: c.contrato,
      quantidade: qn,
      unitario: sob ? 0 : faixa!.preco,
      total: sob ? 0 : round2(faixa!.preco * qn),
      ancora: false,
      descontoPacote: false,
      sobConsulta: sob,
    });
  });

  return {
    linhas,
    total: round2(linhas.reduce((s, l) => s + l.total, 0)),
    sobConsulta: linhas.some((l) => l.sobConsulta),
  };
}

function buscarFaixa(
  modulo: ModuloCode,
  plano: PlanoCode,
  contrato: Contrato,
  q: number,
): FaixaPreco | undefined {
  return TABELA_PRECOS.find(
    (e) =>
      e.modulo === modulo &&
      e.plano === plano &&
      e.contrato === contrato &&
      q >= e.min &&
      (e.max == null || q <= e.max),
  );
}

/** Máximo de posições permitido para o Hiring. */
export const MAX_POSICOES = 8;

/** Uma parte do preço (usuários OU posições). */
export interface PartePreco {
  /** A parte se aplica (há módulos correspondentes selecionados)? */
  ativo: boolean;
  /** Preço por usuário/posição/mês. */
  unitario: number;
  /** Quantidade (usuários ou posições). */
  quantidade: number;
  /** unitario × quantidade. */
  total: number;
  /** Preço a definir nesta parte (ex.: Hiring + Corporativo). */
  sobConsulta: boolean;
}

export interface ResultadoPreco {
  /** Parte cobrada por usuário (Performance/Learning/Project Management). */
  usuarios: PartePreco;
  /** Parte cobrada por posição (Hiring). */
  posicoes: PartePreco;
  /** Soma das partes ativas. */
  total: number;
  /** Alguma parte ativa está sob consulta. */
  sobConsulta: boolean;
}

const PARTE_VAZIA: PartePreco = {
  ativo: false,
  unitario: 0,
  quantidade: 0,
  total: 0,
  sobConsulta: false,
};

function q(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Módulos por usuário, na ordem canônica (exclui os fixos: Hiring e IA). */
function modulosUsuario(modulos: ModuloCode[]): ModuloCode[] {
  return MODULO_CODES.filter(
    (c) => !MODULOS_FIXOS.includes(c) && modulos.includes(c),
  );
}

/**
 * Calcula o preço. Duas partes independentes que se somam:
 *
 * - Usuários: preço do PLANO no módulo âncora + Básico de cada módulo por
 *   usuário adicional, × nº de usuários.
 * - Posições (Hiring): preço por posição (conforme plano) × nº de posições.
 */
export function calcularPreco(params: {
  modulos: ModuloCode[];
  plano: PlanoCode;
  contrato: Contrato;
  usuarios: number;
  posicoes: number;
}): ResultadoPreco {
  const { plano, contrato } = params;
  const qU = q(params.usuarios);
  const qP = q(params.posicoes);

  // --- Parte por usuário ---
  const usuariosPart: PartePreco = { ...PARTE_VAZIA };
  const mods = modulosUsuario(params.modulos);
  if (mods.length > 0) {
    usuariosPart.ativo = true;
    usuariosPart.quantidade = qU;
    const faixaAnchor = buscarFaixa(mods[0], plano, contrato, qU);
    if (!faixaAnchor) {
      usuariosPart.sobConsulta = true;
    } else {
      let unitario = faixaAnchor.preco;
      let sob = faixaAnchor.preco <= 0;
      for (const m of mods.slice(1)) {
        const fb = buscarFaixa(m, "basico", contrato, qU);
        if (!fb || fb.preco <= 0) {
          sob = true;
          continue;
        }
        unitario += fb.preco;
      }
      usuariosPart.sobConsulta = sob;
      usuariosPart.unitario = sob ? 0 : round2(unitario);
      usuariosPart.total = sob ? 0 : round2(usuariosPart.unitario * qU);
    }
  }

  // --- Parte por posição (Hiring) ---
  const posicoesPart: PartePreco = { ...PARTE_VAZIA };
  if (params.modulos.includes("recrutamento")) {
    posicoesPart.ativo = true;
    posicoesPart.quantidade = qP;
    const faixa = buscarFaixa("recrutamento", plano, contrato, qP);
    const sob = !faixa || faixa.preco <= 0;
    posicoesPart.sobConsulta = sob;
    posicoesPart.unitario = sob ? 0 : faixa!.preco;
    posicoesPart.total = sob ? 0 : round2(posicoesPart.unitario * qP);
  }

  const sobConsulta =
    (usuariosPart.ativo && usuariosPart.sobConsulta) ||
    (posicoesPart.ativo && posicoesPart.sobConsulta);

  return {
    usuarios: usuariosPart,
    posicoes: posicoesPart,
    total: round2(usuariosPart.total + posicoesPart.total),
    sobConsulta,
  };
}
