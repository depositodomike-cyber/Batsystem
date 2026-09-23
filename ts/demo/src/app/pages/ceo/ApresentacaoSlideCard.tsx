// Import Dependencies
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars2Icon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import clsx from "clsx";

// Local Imports
import { Button, Collapse, Spinner } from "@/components/ui";
import { DropIndicator } from "@/components/shared/DropIndicator";
import type { PlanoSlide, TipoSlide } from "@/services/api/apresentacao";

// ----------------------------------------------------------------------
// Card de um slide do PLANO.
//
// É leitura, não edição: o conteúdo é produzido pela IA e alterado por
// instrução em linguagem natural, nunca digitando por cima. Por isso não há
// input, textarea nem lápis aqui — a única forma de mudar o slide é
// "Ajustar com IA".
//
// O que muda a ordem (arrastar, ↑/↓) continua existindo: reordenar é dirigir a
// narrativa, não editar o conteúdo.
// ----------------------------------------------------------------------

export const DRAG_TIPO = "apresentacao-item";

/**
 * Qual lista o item pertence — o drop só aceita itens do MESMO modo.
 *
 * "aba" é da tela Criar planilha, que tem card próprio (PlanilhaAbaCard) mas
 * reaproveita este protocolo de arrastar. Acrescentar um membro é
 * retrocompatível: nenhum uso existente precisa mudar, e as duas listas
 * continuam sem se misturar.
 */
export type ModoItem = "slide" | "capitulo" | "aba";

interface DragData {
  tipo: string;
  modo: ModoItem;
  id: string;
}

/** Só aceita itens da MESMA lista. */
export function ehDragDoModo(
  data: Record<string | symbol, unknown>,
  modo: ModoItem,
): boolean {
  return data.tipo === DRAG_TIPO && data.modo === modo;
}

/** Rótulo do tipo, mostrado como etiqueta discreta no cabeçalho do card. */
const ROTULO_TIPO: Record<TipoSlide, string> = {
  capa: "Capa",
  secao: "Transição",
  conteudo: "Conteúdo",
  destaque: "Números em destaque",
  comparacao: "Comparação",
};

interface Props {
  slide: PlanoSlide;
  indice: number;
  total: number;
  modo: ModoItem;
  /** IA processando a instrução deste card. */
  ajustando?: boolean;
  /** Falha do último ajuste. O plano anterior continua visível. */
  erro?: string;
  campoTextarea: string;
  onAjustar: (instrucao: string) => void;
  onRemover: () => void;
  onMover: (de: number, para: number) => void;
}

export function ApresentacaoSlideCard({
  slide,
  indice,
  total,
  modo,
  ajustando,
  erro,
  campoTextarea,
  onAjustar,
  onRemover,
  onMover,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [instrucao, setInstrucao] = useState("");
  const [edge, setEdge] = useState<Edge | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const rotulo = modo === "slide" ? "Slide" : "Capítulo";
  const id = slide.id;

  useEffect(() => {
    const element = cardRef.current;
    const dragHandle = handleRef.current;
    if (!element || !dragHandle) return;

    const data: DragData = { tipo: DRAG_TIPO, modo, id };

    return combine(
      draggable({
        element,
        dragHandle,
        getInitialData: () => ({ ...data }),
        onDragStart: () => setArrastando(true),
        onDrop: () => setArrastando(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => ehDragDoModo(source.data, modo),
        getData: ({ input, element: alvo }) =>
          attachClosestEdge(
            { ...data },
            { input, element: alvo, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [id, modo]);

  const enviar = () => {
    const texto = instrucao.trim();
    if (!texto || ajustando) return;
    onAjustar(texto);
    setInstrucao("");
    setAberto(false);
  };

  return (
    <div
      ref={cardRef}
      // `relative` é requisito do DropIndicator, que se posiciona absoluto.
      className={clsx(
        "dark:border-dark-600 dark:bg-dark-800/40 relative rounded-xl border border-gray-200 p-4 transition-opacity",
        arrastando && "opacity-40",
      )}
      aria-busy={ajustando || undefined}
    >
      <div className="flex flex-wrap items-start gap-2">
        <button
          ref={handleRef}
          type="button"
          aria-label={`Reordenar ${rotulo.toLowerCase()} ${indice + 1} de ${total} (use Alt e as setas para mover)`}
          title="Arrastar para reordenar"
          onKeyDown={(e) => {
            if (!e.altKey) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onMover(indice, indice - 1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onMover(indice, indice + 1);
            }
          }}
          className="dark:text-dark-300 dark:hover:text-dark-100 focus-visible:ring-primary-500/50 mt-0.5 shrink-0 cursor-grab rounded p-1 text-gray-400 outline-hidden hover:text-gray-600 focus-visible:ring-2 active:cursor-grabbing"
        >
          <Bars2Icon className="size-4" />
        </button>

        <span className="dark:bg-dark-600 dark:text-dark-200 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500">
          {indice + 1}
        </span>

        <div className="min-w-0 flex-1 basis-40">
          <h4 className="dark:text-dark-100 text-sm font-semibold text-gray-800">
            {slide.titulo.trim() || (
              <span className="dark:text-dark-300 font-normal text-gray-400">
                Sem título
              </span>
            )}
          </h4>
          {slide.subtitulo && (
            <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
              {slide.subtitulo}
            </p>
          )}
        </div>

        <span className="dark:bg-dark-600 dark:text-dark-300 text-tiny mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
          {ROTULO_TIPO[slide.tipo] ?? ROTULO_TIPO.conteudo}
        </span>

        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          <IconBtn
            label={`Remover ${rotulo.toLowerCase()} ${indice + 1}`}
            danger
            disabled={ajustando}
            onClick={onRemover}
          >
            <TrashIcon className="size-4" />
          </IconBtn>
          <IconBtn
            label="Subir"
            disabled={indice === 0 || ajustando}
            onClick={() => onMover(indice, indice - 1)}
          >
            <ArrowUpIcon className="size-4" />
          </IconBtn>
          <IconBtn
            label="Descer"
            disabled={indice === total - 1 || ajustando}
            onClick={() => onMover(indice, indice + 1)}
          >
            <ArrowDownIcon className="size-4" />
          </IconBtn>
        </div>
      </div>

      {/* Recuo alinhado com o título: alça (28px) + número (24px) + gaps. */}
      <div className="mt-3 ps-15">
        {ajustando ? (
          <p
            aria-live="polite"
            className="dark:text-dark-200 flex items-center gap-2 text-sm text-gray-600"
          >
            <Spinner className="size-4" />
            Ajustando {rotulo.toLowerCase()}…
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Secao rotulo="Objetivo" texto={slide.objetivo} />
            <SecaoLista rotulo="Conteúdo" itens={slide.conteudo} />
            <Secao rotulo="Narrativa" texto={slide.narrativa} />
            <Secao rotulo="Direção visual" texto={slide.direcaoVisual} />
          </div>
        )}

        {erro && !ajustando && (
          <p className="text-error mt-3 text-sm">{erro}</p>
        )}

        {!ajustando && (
          <>
            <Collapse in={aberto}>
              <div className="dark:border-dark-600 mt-3 border-t border-gray-100 pt-3">
                <label className="block text-sm">
                  <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                    O que você gostaria de alterar neste {rotulo.toLowerCase()}?
                  </span>
                  <textarea
                    value={instrucao}
                    onChange={(e) => setInstrucao(e.target.value)}
                    rows={2}
                    placeholder="Ex.: dê mais destaque aos resultados e transforme a comparação numa visualização de dados."
                    className={campoTextarea}
                  />
                </label>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="flat"
                    onClick={() => {
                      setAberto(false);
                      setInstrucao("");
                    }}
                    className="text-xs-plus h-8 px-3"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    color="primary"
                    onClick={enviar}
                    disabled={!instrucao.trim()}
                    className="text-xs-plus h-8 gap-1.5 px-3"
                  >
                    <SparklesIcon className="size-4" />
                    Ajustar {rotulo.toLowerCase()}
                  </Button>
                </div>
              </div>
            </Collapse>

            {!aberto && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setAberto(true)}
                  className="text-xs-plus h-8 gap-1.5 px-3"
                >
                  <SparklesIcon className="size-4" />
                  Ajustar com IA
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {edge && <DropIndicator edge={edge} gap="16px" />}
    </div>
  );
}

/** Rótulo de seção + texto. Some quando o slide não tem esse campo. */
function Secao({ rotulo, texto }: { rotulo: string; texto?: string }) {
  if (!texto?.trim()) return null;
  return (
    <div>
      <RotuloSecao>{rotulo}</RotuloSecao>
      <p className="dark:text-dark-200 text-sm text-gray-600">{texto}</p>
    </div>
  );
}

function SecaoLista({ rotulo, itens }: { rotulo: string; itens?: string[] }) {
  const lista = (itens ?? []).map((i) => i.trim()).filter(Boolean);
  if (!lista.length) return null;
  return (
    <div>
      <RotuloSecao>{rotulo}</RotuloSecao>
      <ul className="dark:text-dark-200 list-disc space-y-1 ps-4 text-sm text-gray-600 marker:text-gray-300">
        {lista.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RotuloSecao({ children }: { children: React.ReactNode }) {
  return (
    <span className="dark:text-dark-300 text-tiny-plus mb-1 block font-medium tracking-wider text-gray-500 uppercase">
      {children}
    </span>
  );
}

function IconBtn({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        "focus-visible:ring-primary-500/50 grid size-7 shrink-0 place-items-center rounded-lg outline-hidden transition-colors focus-visible:ring-2",
        disabled
          ? "dark:text-dark-500 cursor-not-allowed text-gray-200"
          : clsx(
              "dark:hover:bg-dark-600 text-gray-400 hover:bg-gray-100",
              danger
                ? "hover:text-error"
                : "dark:hover:text-dark-100 hover:text-gray-700",
            ),
      )}
    >
      {children}
    </button>
  );
}
