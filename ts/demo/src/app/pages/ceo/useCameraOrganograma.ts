import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ----------------------------------------------------------------------
// Câmera do organograma: zoom em passos + arrastar para navegar.
//
// A "câmera" é o próprio contêiner de ROLAGEM, e não um `translate`. O motivo
// é foco de teclado: ao tabular para um card fora da área visível, o navegador
// rola o contêiner de rolagem mais próximo — que assim É a câmera, e funciona
// sem código. Com `translate`, `scrollLeft` dessincronizaria do offset em
// silêncio, e ainda daria rolagem por toque nos dois eixos de graça.
//
// O zoom é `transform: scale()` (não `zoom` do CSS): `zoom` altera métrica de
// texto, então as linhas re-quebrariam a cada passo e o layout tremeria.
// Como `transform` NÃO altera layout, quem informa o tamanho à rolagem é um
// "sizer" dimensionado por nós — daí a medida da árvore ser necessária.
//
// Regra de escritor único: `scrollLeft/scrollTop` são escritos direto no DOM e
// nunca espelhados em estado; `escala` só muda por evento discreto do React.
// Nada escreve os dois.
// ----------------------------------------------------------------------

/**
 * Escada fixa de zoom. Percentuais redondos, poucos cliques até os extremos e
 * nenhuma deriva de float (somar 0.1 repetidamente dá 0.7000000000000001).
 * Vai até 250% para bater com o controle do desenho de referência.
 */
export const PASSOS_ZOOM = [
  0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5,
] as const;

const INDICE_100 = PASSOS_ZOOM.indexOf(1);

/** Movimento acima disto vira navegação, e o clique do card é engolido. */
const LIMIAR_ARRASTE = 4;

interface Medida {
  w: number;
  h: number;
}

export function useCameraOrganograma() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const arvoreRef = useRef<HTMLDivElement | null>(null);

  const [indice, setIndice] = useState(INDICE_100);
  const escala = PASSOS_ZOOM[indice];

  // Árvore medida SEM escala e tamanho da viewport.
  const [arvore, setArvore] = useState<Medida>({ w: 0, h: 0 });
  const [viewport, setViewport] = useState<Medida>({ w: 0, h: 0 });

  const [arrastando, setArrastando] = useState(false);
  /** Lido pelo onClick dos cards: arrastar não deve abrir o drawer. */
  const arrastou = useRef(false);
  const inicio = useRef<{ x: number; y: number; sl: number; st: number } | null>(
    null,
  );
  /** Ponto do "mundo" a manter no centro da tela depois de mudar a escala. */
  const ancora = useRef<{ cx: number; cy: number } | null>(null);

  // Medida por ResizeObserver. `offsetWidth/Height` de propósito: o
  // `getBoundingClientRect` devolveria o tamanho JÁ escalado e realimentaria o
  // cálculo do sizer num laço.
  useEffect(() => {
    const alvos: [HTMLDivElement | null, (m: Medida) => void][] = [
      [arvoreRef.current, setArvore],
      [viewportRef.current, setViewport],
    ];
    const observers = alvos.map(([el, set]) => {
      if (!el) return null;
      const ro = new ResizeObserver(() => {
        set({ w: el.offsetWidth, h: el.offsetHeight });
      });
      ro.observe(el);
      set({ w: el.offsetWidth, h: el.offsetHeight });
      return ro;
    });
    return () => observers.forEach((ro) => ro?.disconnect());
  }, []);

  /**
   * Muda o zoom guardando o ponto que está no centro da viewport — sem isso,
   * cada clique no +/− teleporta o desenho.
   */
  const mudarZoom = useCallback(
    (delta: number) => {
      setIndice((atual) => {
        const proximo = Math.min(
          Math.max(atual + delta, 0),
          PASSOS_ZOOM.length - 1,
        );
        if (proximo === atual) return atual;
        const v = viewportRef.current;
        if (v) {
          const s = PASSOS_ZOOM[atual];
          ancora.current = {
            cx: (v.scrollLeft + v.clientWidth / 2) / s,
            cy: (v.scrollTop + v.clientHeight / 2) / s,
          };
        }
        return proximo;
      });
    },
    [],
  );

  /** Volta a 100% e recentra — o percentual do controle é este botão. */
  const redefinirZoom = useCallback(() => {
    const v = viewportRef.current;
    if (v) {
      ancora.current = {
        cx: (v.scrollLeft + v.clientWidth / 2) / escala,
        cy: (v.scrollTop + v.clientHeight / 2) / escala,
      };
    }
    setIndice(INDICE_100);
  }, [escala]);

  // Reposiciona ANTES do paint, senão o salto é visível.
  useLayoutEffect(() => {
    const v = viewportRef.current;
    const a = ancora.current;
    if (!v || !a) return;
    ancora.current = null;
    v.scrollLeft = a.cx * escala - v.clientWidth / 2;
    v.scrollTop = a.cy * escala - v.clientHeight / 2;
  }, [escala]);

  // Zoom pela roda SÓ com ctrl/⌘ — esta tela vive dentro de uma página que
  // rola, e capturar a roda simples tiraria do usuário a rolagem da página com
  // o cursor sobre o desenho. Navegadores entregam a pinça de trackpad como
  // wheel + ctrlKey, então o mesmo handler cobre as duas.
  //
  // Listener manual porque o `onWheel` do React é passivo: `preventDefault()`
  // ali não tem efeito e ainda avisa no console.
  useEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      mudarZoom(e.deltaY < 0 ? 1 : -1);
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, [mudarZoom]);

  const iniciarArraste = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const v = viewportRef.current;
    if (!v) return;
    inicio.current = {
      x: e.clientX,
      y: e.clientY,
      sl: v.scrollLeft,
      st: v.scrollTop,
    };
    arrastou.current = false;
    setArrastando(true);
  }, []);

  // Move/solta na WINDOW e sem `setPointerCapture`: capturar retargeta os
  // eventos e mataria o `click` do card sob o cursor (mesma decisão registrada
  // no grafo). Mutar scroll direto mantém o arraste em zero re-render.
  useEffect(() => {
    if (!arrastando) return;

    const mover = (e: PointerEvent) => {
      const a = inicio.current;
      const v = viewportRef.current;
      if (!a || !v) return;
      const dx = e.clientX - a.x;
      const dy = e.clientY - a.y;
      if (Math.hypot(dx, dy) > LIMIAR_ARRASTE) arrastou.current = true;
      v.scrollLeft = a.sl - dx;
      v.scrollTop = a.st - dy;
    };
    const soltar = () => {
      inicio.current = null;
      setArrastando(false);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [arrastando]);

  // O sizer existe só para a rolagem conhecer o tamanho já escalado; o
  // `Math.max` com a viewport mantém um desenho pequeno centrado em vez de
  // preso no canto.
  const sizer = {
    width: Math.max(arvore.w * escala, viewport.w),
    height: Math.max(arvore.h * escala, viewport.h),
  };
  const offsetX = Math.max(0, (viewport.w - arvore.w * escala) / 2);

  return {
    viewportRef,
    arvoreRef,
    escala,
    percentual: Math.round(escala * 100),
    podeAproximar: indice < PASSOS_ZOOM.length - 1,
    podeAfastar: indice > 0,
    mudarZoom,
    redefinirZoom,
    iniciarArraste,
    arrastando,
    arrastou,
    sizer,
    offsetX,
  };
}
