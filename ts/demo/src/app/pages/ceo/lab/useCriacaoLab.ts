import { useEffect, useRef } from "react";

import type {
  CriacaoCompleta,
  CriacaoStatus,
  CriacaoTipo,
} from "@/services/api/criacoes";

import { useCriacao, type EstadoCriacao } from "../criacoes/useCriacao";

/** Passo das ferramentas de etapa única do Lab: configurar → gerar → pronto. */
export type PassoLab = "form" | "gerando" | "pronta";

/**
 * Minhas criações para as ferramentas do Lab que geram num passo só (Artigo,
 * Ata, Dashboard…). Mesmo contrato de Apresentação e Planilha — rascunho só
 * quando há trabalho relevante, autosave com debounce, marco gravado na hora ao
 * ficar pronto, retomada por `?criacao=` — sem repetir o encanamento em cada
 * tela.
 */
export function useCriacaoLab<D extends Record<string, unknown>>({
  tipo,
  passo,
  erro,
  relevante,
  titulo,
  dados,
  restaurar,
  idInicial,
}: {
  tipo: CriacaoTipo;
  passo: PassoLab;
  /** Última geração falhou? Vira status "erro" na lista. */
  erro?: boolean;
  /** Já há trabalho que valha um registro? */
  relevante: boolean;
  titulo: string;
  /** Briefing + resultado — tudo o que a tela precisa para ser retomada. */
  dados: D;
  /** Recoloca a tela no estado salvo (chamado uma vez, ao retomar). */
  restaurar: (dados: Partial<D>, criacao: CriacaoCompleta) => void;
  /** Só para janelas (fora do router): id a retomar. */
  idInicial?: string | null;
}) {
  const criacao = useCriacao(
    tipo,
    idInicial !== undefined ? { idInicial } : {},
  );

  const status: CriacaoStatus =
    passo === "gerando"
      ? "gerando"
      : passo === "pronta"
        ? "concluido"
        : erro
          ? "erro"
          : "rascunho";
  const estado: EstadoCriacao = {
    relevante,
    titulo,
    status,
    etapa: passo === "pronta" ? "resultado" : "configuracao",
    dados,
  };
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Retomada: uma vez, quando a criação chega do servidor.
  const restaurado = useRef(false);
  const restaurarRef = useRef(restaurar);
  restaurarRef.current = restaurar;
  useEffect(() => {
    if (!criacao.carregada || restaurado.current) return;
    restaurado.current = true;
    restaurarRef.current(criacao.carregada.dados as Partial<D>, criacao.carregada);
  }, [criacao.carregada]);

  // Autosave: a cada mudança relevante, com debounce (no hook de base). Durante
  // a geração não: o marco de "pronta" grava logo em seguida.
  const assinatura = JSON.stringify([titulo, status, dados]);
  useEffect(() => {
    if (criacao.carregando || passo === "gerando") return;
    criacao.sincronizar(estadoRef.current);
    // `criacao.sincronizar` é estável; a assinatura resume o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, criacao.carregando]);

  // Marco: ficou pronta → grava na hora.
  const passoAnterior = useRef(passo);
  useEffect(() => {
    if (passoAnterior.current !== passo && passo === "pronta") {
      void criacao.gravarAgora(estadoRef.current);
    }
    passoAnterior.current = passo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  return {
    ...criacao,
    /** Grava agora o estado atual (marcos próprios da tela, ex.: id de render). */
    gravarJa: () => criacao.gravarAgora(estadoRef.current),
  };
}
