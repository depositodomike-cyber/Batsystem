// ----------------------------------------------------------------------
// Player do briefing falado. Toca o roteiro segmento a segmento com a voz do
// navegador (utils/falar), guardando onde parou: pausar = interromper e
// lembrar o segmento; retomar = falar o segmento de novo. É mais confiável
// que speechSynthesis.pause(), que falha com várias vozes do Chrome.
//
// Qualquer outra fala (palavra de ativação, nova pergunta, microfone) chama
// pararFala(); o player percebe a interrupção e fica "pausado", pronto para
// continuar de onde parou.
// ----------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

import { falaSuportada, falar, pararFala } from "@/utils/falar";
import type { SegmentoRoteiro } from "@/services/api/briefing";
import { definirTrechoAtual } from "./sessao";

export type EstadoVoz = "aguardando" | "falando" | "pausado" | "concluido";

export function useBriefingVoz(roteiro: SegmentoRoteiro[], idioma: "pt" | "en") {
  const [estado, setEstado] = useState<EstadoVoz>("aguardando");
  const [indice, setIndice] = useState(0);
  const [volume, setVolume] = useState(1);
  const tokenRef = useRef(0);
  const volumeRef = useRef(1);
  const roteiroRef = useRef(roteiro);

  useEffect(() => {
    roteiroRef.current = roteiro;
  }, [roteiro]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const tocar = useCallback(
    /** segs: roteiro recém-carregado (antes do próximo render). */
    (desde: number, segs: SegmentoRoteiro[] = roteiroRef.current) => {
      roteiroRef.current = segs;
      if (!falaSuportada() || !segs.length) return;
      const token = ++tokenRef.current;
      const falarSeg = (i: number) => {
        if (token !== tokenRef.current) return;
        if (i >= segs.length) {
          setEstado("concluido");
          setIndice(segs.length - 1);
          definirTrechoAtual("");
          return;
        }
        setIndice(i);
        setEstado("falando");
        definirTrechoAtual(segs[i].texto);
        void falar(segs[i].texto, {
          idioma: idioma === "en" ? "en-US" : "pt-BR",
          semLimite: true,
          volume: volumeRef.current,
          onFim: (motivo) => {
            if (token !== tokenRef.current) return;
            if (motivo === "interrompido") {
              setEstado("pausado");
              return;
            }
            falarSeg(i + 1);
          },
        });
      };
      falarSeg(Math.max(0, Math.min(desde, segs.length - 1)));
    },
    [idioma],
  );

  const pausar = useCallback(() => {
    tokenRef.current++;
    pararFala();
    setEstado("pausado");
  }, []);

  const parar = useCallback(() => {
    tokenRef.current++;
    pararFala();
    definirTrechoAtual("");
    setEstado("aguardando");
    setIndice(0);
  }, []);

  const retomar = useCallback(() => tocar(indice), [tocar, indice]);
  const repetir = useCallback(() => tocar(0), [tocar]);

  // Sair da página cala o briefing.
  useEffect(
    () => () => {
      tokenRef.current++;
      pararFala();
    },
    [],
  );

  const segmentoAtual = estado === "falando" || estado === "pausado" ? roteiro[indice] : undefined;

  return {
    suportada: falaSuportada(),
    estado,
    indice,
    segmentoAtual,
    volume,
    setVolume,
    tocar,
    pausar,
    retomar,
    parar,
    repetir,
  };
}
