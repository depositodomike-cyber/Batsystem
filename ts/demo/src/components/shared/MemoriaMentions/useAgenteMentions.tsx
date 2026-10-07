// ----------------------------------------------------------------------
// Gatilho "@" — chamar um AGENTE para participar da mensagem.
//
// Irmão do gatilho "[[" (useMemoriaMentions): mesma detecção pelo cursor, mesma
// medição de caret, mesmo menu em portal com posição fixa e o mesmo teclado.
// A diferença é a fonte (agentes do sistema + do usuário) e o que é inserido:
// "@Menção " — texto comum, que o Assistente reconhece no envio.
//
// "@" só conta no início do texto ou depois de um espaço: "ana@empresa.com"
// não abre a lista.
// ----------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import type { AgenteMencionavel } from "@/app/contexts/agentes/context";
import { MenuAgentes } from "./MenuAgentes";
import { caretCoords, type CaretPos } from "./caret";

type Campo = HTMLTextAreaElement | HTMLInputElement;

interface Gatilho {
  /** Índice do "@". */
  inicio: number;
  /** O que já foi digitado depois do "@". */
  query: string;
}

const GATILHO = /(^|\s)@([\p{L}\p{N}]{0,40})$/u;

function gatilhoNoCursor(valor: string, cursor: number): Gatilho | null {
  const antes = valor.slice(0, cursor);
  const m = antes.match(GATILHO);
  if (!m || m.index === undefined) return null;
  return { inicio: m.index + m[1].length, query: m[2] };
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Agentes que casam com o termo — pelo nome ou pela menção, sem acento. */
function filtrar(agentes: AgenteMencionavel[], query: string) {
  const termo = normalizar(query.trim());
  if (!termo) return agentes;
  const pontuar = (a: AgenteMencionavel) => {
    const nome = normalizar(a.titulo);
    const mencao = normalizar(a.mencao);
    if (mencao.startsWith(termo) || nome.startsWith(termo)) return 0;
    if (nome.split(/\s+/).some((p) => p.startsWith(termo))) return 1;
    if (nome.includes(termo) || mencao.includes(termo)) return 2;
    return -1;
  };
  return agentes
    .map((a) => ({ a, p: pontuar(a) }))
    .filter((x) => x.p >= 0)
    .sort((x, y) => x.p - y.p)
    .map((x) => x.a);
}

export interface AgenteMentions {
  aberto: boolean;
  sincronizar: () => void;
  aoTeclar: (e: KeyboardEvent<Campo>) => boolean;
  fechar: () => void;
  menu: ReactNode;
}

export function useAgenteMentions<T extends Campo = Campo>(
  ref: RefObject<T | null>,
  aplicar: (valor: string, cursor: number) => void,
  /** Agentes mencionáveis; `undefined` desliga o gatilho. */
  agentes: AgenteMencionavel[] | undefined,
  desabilitado = false,
): AgenteMentions {
  const [gatilho, setGatilho] = useState<Gatilho | null>(null);
  const [pos, setPos] = useState<CaretPos | null>(null);
  const [ativo, setAtivo] = useState(0);

  const ligado = !!agentes && agentes.length > 0 && !desabilitado;

  // Ordem do menu = ordem da navegação: sistema primeiro, depois os do usuário.
  const itens = useMemo(() => {
    if (!agentes || !gatilho) return [];
    const filtrados = filtrar(agentes, gatilho.query);
    return [
      ...filtrados.filter((a) => a.tipo === "sistema"),
      ...filtrados.filter((a) => a.tipo === "pessoal"),
    ];
  }, [agentes, gatilho]);

  const aberto = ligado && gatilho !== null && pos !== null;

  const fechar = useCallback(() => {
    setGatilho(null);
    setPos(null);
    setAtivo(0);
  }, []);

  const sincronizar = useCallback(() => {
    const el = ref.current;
    if (!ligado || !el) return;
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
      setAtivo(0);
    }
    setPos(caretCoords(el, cursor));
  }, [ref, ligado, gatilho, fechar]);

  // Fecha ao rolar/redimensionar: a posição fixa do menu ficaria descolada.
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

  // Troca "@cul" por "@Cultura " e devolve o cursor logo depois do espaço.
  const escolher = useCallback(
    (agente: AgenteMencionavel) => {
      const el = ref.current;
      if (!el || !gatilho) return;
      const cursor = el.selectionStart ?? el.value.length;
      const depois = el.value.slice(cursor);
      const mencao = `@${agente.mencao}`;
      const espaco = depois.startsWith(" ") ? "" : " ";
      const valor = el.value.slice(0, gatilho.inicio) + mencao + espaco + depois;
      fechar();
      aplicar(valor, gatilho.inicio + mencao.length + 1);
    },
    [ref, gatilho, aplicar, fechar],
  );

  const aoTeclar = useCallback(
    (e: KeyboardEvent<Campo>): boolean => {
      if (!aberto) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const passo = e.key === "ArrowDown" ? 1 : -1;
        setAtivo((i) =>
          itens.length ? (i + passo + itens.length) % itens.length : 0,
        );
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const alvo = itens[ativo];
        // Sem agente que case, o Enter segue para o campo (envia normalmente).
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
    [aberto, itens, ativo, escolher, fechar],
  );

  const menu = aberto ? (
    <MenuAgentes
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
