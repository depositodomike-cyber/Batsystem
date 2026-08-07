// ----------------------------------------------------------------------
// Gatilho "[[" — conectar o que está sendo escrito ao Contexto.
//
// Regra do produto: em todo conteúdo editável (AI Studio, E-mail, Slack,
// respostas de squad e prompts), digitar "[[" abre a lista de alvos do Contexto
// e a escolha insere um [[wikilink]] — o mesmo formato que o grafo já lê para
// desenhar as arestas (ver memoria-grupos.ts e conexoes-vault.ts no backend).
//
// O hook cuida da detecção, do teclado e da inserção; o menu vai num portal
// com posição fixa porque a maioria dos campos vive dentro de modais com
// overflow, onde um dropdown "absolute" seria cortado.
// ----------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { useMemoryContext } from "@/app/contexts/memory/context";
import { MenuMemoria } from "./MenuMemoria";
import { caretCoords, type CaretPos } from "./caret";
import {
  buscarNotasRemoto,
  carregarNotas,
  filtrarAlvos,
  type AlvoMemoria,
} from "./alvos";

/** Quantos itens a lista mostra por vez. */
const MAX_ITENS = 8;

type Campo = HTMLTextAreaElement | HTMLInputElement;

interface Gatilho {
  /** Índice do primeiro "[" no texto. */
  inicio: number;
  /** O que já foi digitado depois de "[[". */
  query: string;
}

/**
 * Encontra um "[[" aberto imediatamente antes do cursor. Volta `null` quando o
 * par já foi fechado, quando há quebra de linha no meio (a pessoa desistiu) ou
 * quando o trecho ficou longo demais para ser um título.
 */
function gatilhoNoCursor(valor: string, cursor: number): Gatilho | null {
  const antes = valor.slice(0, cursor);
  const inicio = antes.lastIndexOf("[[");
  if (inicio < 0) return null;
  const query = antes.slice(inicio + 2);
  if (query.includes("]") || query.includes("[") || query.includes("\n")) {
    return null;
  }
  if (query.length > 80) return null;
  return { inicio, query };
}

export interface MemoriaMentions {
  /** `true` enquanto o menu está aberto (o campo deve deixar o teclado passar). */
  aberto: boolean;
  /** Reavalia o gatilho — chame depois de digitar/mover o cursor. */
  sincronizar: () => void;
  /** Trate o teclado ANTES do campo; devolve `true` quando consumiu a tecla. */
  aoTeclar: (e: KeyboardEvent<Campo>) => boolean;
  fechar: () => void;
  /** O menu, já em portal. Renderize junto do campo. */
  menu: ReactNode;
}

export function useMemoriaMentions<T extends Campo = Campo>(
  ref: RefObject<T | null>,
  /** Aplica o texto com o wikilink inserido e reposiciona o cursor. */
  aplicar: (valor: string, cursor: number) => void,
  desabilitado = false,
): MemoriaMentions {
  const { memories } = useMemoryContext();

  const [gatilho, setGatilho] = useState<Gatilho | null>(null);
  const [pos, setPos] = useState<CaretPos | null>(null);
  const [notas, setNotas] = useState<AlvoMemoria[]>([]);
  const [remotas, setRemotas] = useState<AlvoMemoria[]>([]);
  const [ativo, setAtivo] = useState(0);

  const aberto = !desabilitado && gatilho !== null && pos !== null;

  // Regras ativas (store /memorias) — já estão em memória no contexto.
  const diretrizes = useMemo<AlvoMemoria[]>(
    () =>
      memories
        .filter((m) => m.active !== false)
        .map((m) => ({
          titulo: m.title,
          detalhe: m.category || "Regra",
          tipo: "diretriz" as const,
        })),
    [memories],
  );

  const itens = useMemo(
    () =>
      filtrarAlvos(
        [...notas, ...remotas, ...diretrizes],
        gatilho?.query ?? "",
        MAX_ITENS,
      ),
    [notas, remotas, diretrizes, gatilho],
  );

  const fechar = useCallback(() => {
    setGatilho(null);
    setPos(null);
    setRemotas([]);
    setAtivo(0);
  }, []);

  // Reavalia o gatilho a partir do estado atual do campo.
  const sincronizar = useCallback(() => {
    const el = ref.current;
    if (desabilitado || !el) return;
    const cursor = el.selectionStart ?? el.value.length;
    const g = gatilhoNoCursor(el.value, cursor);
    if (!g) {
      if (gatilho) fechar();
      return;
    }
    const mesmo =
      !!gatilho && gatilho.inicio === g.inicio && gatilho.query === g.query;
    if (!mesmo) {
      setGatilho(g);
      // Só volta ao topo da lista quando o termo muda — senão a navegação por
      // seta seria desfeita pelo `keyup` da própria seta.
      setAtivo(0);
    }
    setPos(caretCoords(el, cursor));
  }, [ref, desabilitado, gatilho, fechar]);

  // Notas do vault: carregadas na primeira vez que alguém digita "[[".
  const temGatilho = gatilho !== null;
  useEffect(() => {
    if (!temGatilho) return;
    let vivo = true;
    carregarNotas().then((a) => {
      if (vivo) setNotas(a);
    });
    return () => {
      vivo = false;
    };
  }, [temGatilho]);

  // Termo que o cache local não cobriu: completa com uma busca no servidor,
  // depois de uma pausa na digitação. A checagem de "poucos resultados" fica
  // numa ref porque é consequência da busca — se entrasse nas deps do efeito,
  // cada resposta que chegasse dispararia uma busca nova.
  const query = gatilho?.query ?? "";
  const poucosLocais = useRef(false);
  poucosLocais.current = itens.length < 5;
  useEffect(() => {
    if (query.trim().length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      if (!poucosLocais.current) return;
      buscarNotasRemoto(query.trim()).then((a) => {
        if (vivo) setRemotas(a);
      });
    }, 220);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [query]);

  // Fecha ao rolar a página/modal: a posição fixa do menu ficaria descolada.
  useEffect(() => {
    if (!aberto) return;
    const ao = () => fechar();
    window.addEventListener("scroll", ao, true);
    window.addEventListener("resize", ao);
    return () => {
      window.removeEventListener("scroll", ao, true);
      window.removeEventListener("resize", ao);
    };
  }, [aberto, fechar]);

  // Insere [[Título]] no lugar do gatilho e devolve o foco ao campo.
  const escolher = useCallback(
    (titulo: string) => {
      const el = ref.current;
      if (!el || !gatilho) return;
      const cursor = el.selectionStart ?? el.value.length;
      const depois = el.value.slice(cursor);
      // Se a pessoa já tinha os colchetes de fechamento à frente, aproveita-os
      // em vez de deixar "]]]]".
      const fechamento = depois.startsWith("]]") ? 2 : 0;
      const link = `[[${titulo}]]`;
      const valor =
        el.value.slice(0, gatilho.inicio) + link + depois.slice(fechamento);
      fechar();
      aplicar(valor, gatilho.inicio + link.length);
    },
    [ref, gatilho, aplicar, fechar],
  );

  const aoTeclar = useCallback(
    (e: KeyboardEvent<Campo>): boolean => {
      if (!aberto) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtivo((i) => (itens.length ? (i + 1) % itens.length : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtivo((i) =>
          itens.length ? (i - 1 + itens.length) % itens.length : 0,
        );
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const alvo = itens[ativo]?.titulo ?? gatilho?.query.trim();
        if (!alvo) return false;
        e.preventDefault();
        e.stopPropagation();
        escolher(alvo);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
        return true;
      }
      return false;
    },
    [aberto, itens, ativo, gatilho, escolher, fechar],
  );

  const menu = aberto ? (
    <MenuMemoria
      itens={itens}
      ativo={ativo}
      query={gatilho?.query ?? ""}
      pos={pos!}
      onEscolher={escolher}
      onAtivar={setAtivo}
    />
  ) : null;

  return { aberto, sincronizar, aoTeclar, fechar, menu };
}
