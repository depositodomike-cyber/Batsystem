import { useRef, useState } from "react";

import type { EtapaStatus } from "../ApresentacaoEtapa";

export interface EtapaLab<Id extends string> {
  id: Id;
  numero: string;
  titulo: string;
}

/**
 * Estado do wizard de etapas do Lab — o mesmo comportamento de Apresentação e
 * Planilha: uma etapa aberta por vez, as concluídas viram resumo editável, as
 * pendentes ficam discretas. `null` = todas recolhidas (revisão antes de gerar).
 */
export function useEtapasLab<Id extends string>(
  etapas: readonly EtapaLab<Id>[],
  resumos: Partial<Record<Id, string>> = {},
) {
  const [etapaAtiva, setEtapaAtiva] = useState<Id | null>(
    etapas[0]?.id ?? null,
  );
  const [resolvidas, setResolvidas] = useState<Set<Id>>(() => new Set<Id>());
  const cardsRef = useRef<Partial<Record<Id, HTMLDivElement | null>>>({});

  const proxima = (id: Id): Id | null => {
    const i = etapas.findIndex((e) => e.id === id);
    return i >= 0 && i < etapas.length - 1 ? etapas[i + 1].id : null;
  };

  const irPara = (id: Id) => {
    setEtapaAtiva(id);
    // Depois do paint: o painel só existe na próxima renderização.
    requestAnimationFrame(() =>
      cardsRef.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
  };

  /** Marca a etapa como resolvida e abre a seguinte; na última, recolhe tudo. */
  const concluirEtapa = (id: Id) => {
    setResolvidas((prev) => new Set(prev).add(id));
    const prox = proxima(id);
    if (prox) irPara(prox);
    else setEtapaAtiva(null);
  };

  const statusEtapa = (id: Id): EtapaStatus =>
    etapaAtiva === id ? "ativa" : resolvidas.has(id) ? "concluida" : "pendente";

  /** Marca todas como resolvidas e recolhe (ex.: ao restaurar uma criação). */
  const resolverTodas = () => {
    setResolvidas(new Set(etapas.map((e) => e.id)));
    setEtapaAtiva(null);
  };

  /** Volta ao início (nova criação). */
  const reiniciar = () => {
    setResolvidas(new Set<Id>());
    setEtapaAtiva(etapas[0]?.id ?? null);
  };

  /** Meta + estado de uma etapa, no formato que o `LabEtapa` espera. */
  const etapa = (id: Id) => {
    const e = etapas.find((x) => x.id === id)!;
    return {
      id,
      numero: e.numero,
      titulo: e.titulo,
      status: statusEtapa(id),
      resumo: resumos[id],
      innerRef: (el: HTMLDivElement | null) => {
        cardsRef.current[id] = el;
      },
    };
  };

  /** Props do <Accordion> que envolve as etapas. */
  const accordion = {
    value: etapaAtiva ?? "",
    // Clicar no cabeçalho já aberto devolve "" — recolhe tudo.
    onChange: (v: string | string[]) =>
      setEtapaAtiva(((Array.isArray(v) ? v[0] : v) as Id) || null),
  };

  return {
    etapaAtiva,
    irPara,
    concluirEtapa,
    statusEtapa,
    resolverTodas,
    reiniciar,
    etapa,
    accordion,
  };
}
