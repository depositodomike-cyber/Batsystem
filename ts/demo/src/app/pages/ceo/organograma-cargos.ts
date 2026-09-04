import Color from "color";

import type { Membro } from "@/services/api/membros";
import { rotuloCargo } from "./membros-status";
import { PALETA } from "./memoria-grafo-modelo";

// ----------------------------------------------------------------------
// Agrupamento por CARGO para a legenda do organograma.
//
// Cargo é a posição profissional — não concede permissão nem define
// hierarquia. Aqui ele serve só como dimensão de leitura visual: a legenda
// pinta os cargos para dar para achar "quem são os designers" num desenho
// largo.
//
// Por que não `ColorType`: a paleta tem 7 tokens e, tirando `neutral`,
// primary/info e warning/error são indistinguíveis num ponto de 8px. Pior,
// success/warning/neutral JÁ significam status no mesmo card — um anel `error`
// leria como "problema", não como "Analista". Então reusamos os tons
// categóricos do grafo (PALETA), que existem exatamente para legenda.
//
// Por que não `colorFromText`: ela hasheia só o ÚLTIMO caractere
// (charCode % 7), e nos rótulos reais isso colapsa os cargos em pouquíssimas
// cores — "Diretor(a)", "Coordenador(a)" e "Estagiário(a)" terminam em ")";
// "Product Designer" e "Business Partner" terminam em "r". A alocação por
// índice abaixo é livre de colisão até esgotar a paleta.
// ----------------------------------------------------------------------

/** Id do grupo de quem não tem cargo definido. */
export const SEM_CARGO = "__sem_cargo__";
/** Id do grupo que recolhe os cargos além da paleta. */
export const OUTROS_CARGOS = "__outros_cargos__";

/** Cinza dos grupos sem cor própria (sem cargo e excedente). */
const CINZA = "#9CA3AF";

export interface GrupoCargo {
  /** `cargoId`, ou o rótulo normalizado quando só existe o código legado. */
  id: string;
  rotulo: string;
  total: number;
  /** Tom para o tema claro (escurecido: a PALETA é calibrada para fundo escuro). */
  cor: string;
  /** Tom para o tema escuro — a cor da paleta, como no grafo. */
  corDark: string;
}

/**
 * Id do grupo de um membro. Prefere `cargoId` (a entidade) e cai no rótulo
 * normalizado, para quem ainda carrega só o código legado em `membro.cargo`
 * continuar agrupando junto de quem já foi reconfigurado.
 */
export function grupoDoMembro(membro: Membro): string {
  if (membro.cargoId) return membro.cargoId;
  const rotulo = rotuloCargo(membro).trim().toLowerCase();
  return rotulo || SEM_CARGO;
}

/**
 * Grupos de cargo presentes na lista, já com cor.
 *
 * Ordenados por contagem decrescente (e nome, para desempate estável): assim
 * os grupos maiores mantêm a cor quando um cargo pequeno aparece depois. O
 * custo assumido é que acrescentar um cargo pode remexer os tons entre
 * sessões — aceitável, porque a legenda está sempre na tela nomeando cada cor.
 *
 * "Sem cargo" e o excedente da paleta ficam sempre por último, em cinza:
 * reusar um tom faria a legenda mentir sobre quem pertence a qual grupo.
 */
export function agruparPorCargo(membros: Membro[]): GrupoCargo[] {
  const porId = new Map<string, { rotulo: string; total: number }>();

  for (const membro of membros) {
    const id = grupoDoMembro(membro);
    const atual = porId.get(id);
    if (atual) {
      atual.total++;
      continue;
    }
    porId.set(id, {
      rotulo: id === SEM_CARGO ? "Sem cargo" : rotuloCargo(membro) || "Sem cargo",
      total: 1,
    });
  }

  const semCargo = porId.get(SEM_CARGO);
  porId.delete(SEM_CARGO);

  const ordenados = [...porId.entries()].sort(
    (a, b) => b[1].total - a[1].total || a[1].rotulo.localeCompare(b[1].rotulo, "pt-BR"),
  );

  const grupos: GrupoCargo[] = ordenados
    .slice(0, PALETA.length)
    .map(([id, { rotulo, total }], i) => ({
      id,
      rotulo,
      total,
      cor: escurecer(PALETA[i]),
      corDark: PALETA[i],
    }));

  // Excedente num único grupo nomeado, em vez de repetir tons.
  const excedente = ordenados.slice(PALETA.length);
  if (excedente.length > 0) {
    grupos.push({
      id: OUTROS_CARGOS,
      rotulo: `Outros cargos (${excedente.length})`,
      total: excedente.reduce((soma, [, g]) => soma + g.total, 0),
      cor: CINZA,
      corDark: CINZA,
    });
  }

  if (semCargo) {
    grupos.push({
      id: SEM_CARGO,
      rotulo: "Sem cargo",
      total: semCargo.total,
      cor: CINZA,
      corDark: CINZA,
    });
  }

  return grupos;
}

/**
 * Id do grupo COMO A LEGENDA o conhece: quem caiu no excedente responde pelo
 * grupo "Outros cargos", senão o realce não acharia esses cards.
 */
export function grupoNaLegenda(membro: Membro, grupos: GrupoCargo[]): string {
  const id = grupoDoMembro(membro);
  return grupos.some((g) => g.id === id) ? id : OUTROS_CARGOS;
}

/**
 * A PALETA foi calibrada para o canvas escuro do grafo (tons pastel), e num
 * card branco um anel amarelo-claro quase não aparece. Escurecer resolve sem
 * criar uma segunda paleta à mão.
 *
 * 0.34 medido: leva o contraste do pior tom contra o branco de 1.48 para 2.30.
 * Sem `saturate` de propósito — saturar junto empurrava alguns tons para cores
 * puras (#F87171 virava #FF0000), e um anel vermelho puro leria como "erro"
 * num card que já usa cor para status.
 */
function escurecer(hex: string): string {
  try {
    return Color(hex).darken(0.34).hex();
  } catch {
    return hex; // paleta inválida não deve derrubar a tela
  }
}
