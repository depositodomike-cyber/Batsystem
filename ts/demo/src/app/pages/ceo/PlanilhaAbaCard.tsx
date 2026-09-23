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
import { DRAG_TIPO, ehDragDoModo } from "./ApresentacaoSlideCard";
import type {
  PlanoAba,
  PlanoCalculo,
  PlanoColuna,
  TipoAba,
  TipoColuna,
} from "@/services/api/planilha";

// ----------------------------------------------------------------------
// Card de uma ABA do plano da planilha.
//
// Irmão de `ApresentacaoSlideCard`: mesma moldura, mesma alça de arrastar,
// mesmas ações, mesmo "Ajustar com IA". É leitura e direção — não há input de
// conteúdo, porque o plano é da IA e a instrução é do usuário.
//
// Duas regras do briefing moram aqui:
//
// - LÓGICA ANTES DA FÓRMULA: o card fechado mostra "Saldo = Orçamento −
//   Realizado" em português. A fórmula de planilha só aparece em "Ver
//   detalhes", para quem quiser conferir. Quem não sabe Excel consegue validar
//   a planilha antes de ela existir.
// - DIVULGAÇÃO PROGRESSIVA: fechado são nome, objetivo, principais colunas e
//   principais cálculos. Tipo de coluna, validação, dependência e fonte ficam
//   atrás do "Ver detalhes".
// ----------------------------------------------------------------------

/** Quantas colunas e cálculos aparecem com o card fechado. */
const RESUMO_MAX = 5;

const ROTULO_TIPO: Record<TipoAba, string> = {
  dados: "Base de dados",
  resumo: "Consolidação",
  apoio: "Apoio",
};

const ROTULO_COLUNA: Record<TipoColuna, string> = {
  texto: "Texto",
  numero: "Número",
  moeda: "Moeda",
  percentual: "Percentual",
  data: "Data",
  lista: "Lista",
};

interface Props {
  aba: PlanoAba;
  indice: number;
  total: number;
  /** IA processando a instrução desta aba. */
  ajustando?: boolean;
  /** Falha do último ajuste. O plano anterior continua visível. */
  erro?: string;
  /**
   * O que o último ajuste desta aba afeta nas outras. Declarado pela IA e NÃO
   * aplicado: mudar as outras abas continua sendo decisão do usuário.
   */
  impactos?: string[];
  campoTextarea: string;
  onAjustar: (instrucao: string) => void;
  onRemover: () => void;
  onMover: (de: number, para: number) => void;
}

export function PlanilhaAbaCard({
  aba,
  indice,
  total,
  ajustando,
  erro,
  impactos,
  campoTextarea,
  onAjustar,
  onRemover,
  onMover,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const [instrucao, setInstrucao] = useState("");
  const [edge, setEdge] = useState<Edge | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const id = aba.id;

  useEffect(() => {
    const element = cardRef.current;
    const dragHandle = handleRef.current;
    if (!element || !dragHandle) return;

    const data = { tipo: DRAG_TIPO, modo: "aba" as const, id };

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
        canDrop: ({ source }) => ehDragDoModo(source.data, "aba"),
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
  }, [id]);

  const enviar = () => {
    const texto = instrucao.trim();
    if (!texto || ajustando) return;
    onAjustar(texto);
    setInstrucao("");
    setAberto(false);
  };

  const colunas = aba.colunas ?? [];
  const calculos = aba.calculos ?? [];
  const indicadores = aba.indicadores ?? [];
  const validacoes = (aba.validacoes ?? []).filter((v) => v.trim());
  const dependencias = (aba.dependencias ?? []).filter((d) => d.trim());
  const fontes = (aba.fontes ?? []).filter((f) => f.trim());
  const impactosLimpos = (impactos ?? []).filter((i) => i.trim());

  // Há algo além do que o card já mostra fechado? Sem isto, "Ver detalhes"
  // abriria um painel vazio em abas simples.
  const temDetalhes =
    colunas.length > RESUMO_MAX ||
    colunas.some((c) => c.descricao || c.validacao || c.formula) ||
    calculos.length > RESUMO_MAX ||
    [...calculos, ...indicadores].some((c) => c.formula) ||
    validacoes.length > 0 ||
    dependencias.length > 0 ||
    fontes.length > 0;

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
          aria-label={`Reordenar aba ${indice + 1} de ${total} (use Alt e as setas para mover)`}
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
            {aba.nome.trim() || (
              <span className="dark:text-dark-300 font-normal text-gray-400">
                Sem nome
              </span>
            )}
          </h4>
        </div>

        <span className="dark:bg-dark-600 dark:text-dark-300 text-tiny mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
          {ROTULO_TIPO[aba.tipo] ?? ROTULO_TIPO.dados}
        </span>

        {/* Etiqueta, e não um parágrafo: sem fonte de dados a IA marca quase
            toda aba como exemplo, e repetir a mesma frase em cada card viraria
            ruído. O que importa é que ninguém confunda exemplo com dado real —
            e para isso a etiqueta basta, aqui e no arquivo. */}
        {aba.dadosExemplo && (
          <span
            title="Vai trazer linhas de exemplo, marcadas como exemplo no arquivo."
            className="dark:bg-dark-600 dark:text-dark-300 text-tiny mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500"
          >
            Com exemplos
          </span>
        )}

        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          <IconBtn
            label={`Excluir aba ${indice + 1}`}
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
          // <div>, e não <p>: o Spinner renderiza uma div, e div dentro de p é
          // HTML inválido — o React acusa erro de hidratação no console.
          <div
            aria-live="polite"
            className="dark:text-dark-200 flex items-center gap-2 text-sm text-gray-600"
          >
            <Spinner className="size-4" />
            Ajustando aba…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Secao rotulo="Objetivo" texto={aba.objetivo} />
            <SecaoLista
              rotulo="Principais dados"
              itens={colunas.slice(0, RESUMO_MAX).map((c) => c.nome)}
              restante={Math.max(0, colunas.length - RESUMO_MAX)}
            />
            <SecaoLista
              rotulo="Cálculos"
              // Lógica de negócio, nunca a fórmula: quem revisa não precisa
              // saber Excel para dizer se a conta está certa.
              itens={calculos
                .slice(0, RESUMO_MAX)
                .map((c) => (c.logica ? `${c.nome} = ${c.logica}` : c.nome))}
              restante={Math.max(0, calculos.length - RESUMO_MAX)}
            />
            <SecaoLista
              rotulo="Indicadores"
              itens={indicadores.map((i) => i.nome)}
            />
          </div>
        )}

        {erro && !ajustando && (
          <p className="text-error mt-3 text-sm">{erro}</p>
        )}

        {impactosLimpos.length > 0 && !ajustando && (
          <div className="dark:border-dark-600 dark:bg-dark-700/40 mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <RotuloSecao>Também afeta</RotuloSecao>
            <ul className="dark:text-dark-200 list-disc space-y-1 ps-4 text-sm text-gray-600 marker:text-gray-300">
              {impactosLimpos.map((i, n) => (
                <li key={n}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        {!ajustando && (
          <>
            <Collapse in={detalhes}>
              <div className="dark:border-dark-600 mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
                {colunas.length > 0 && (
                  <div>
                    <RotuloSecao>Colunas</RotuloSecao>
                    <ul className="dark:divide-dark-600 divide-y divide-gray-100">
                      {colunas.map((c, n) => (
                        <ColunaLinha key={n} coluna={c} />
                      ))}
                    </ul>
                  </div>
                )}
                <SecaoFormulas rotulo="Fórmulas" itens={calculos} />
                <SecaoFormulas rotulo="Indicadores" itens={indicadores} />
                <SecaoLista rotulo="Validações" itens={validacoes} />
                <Secao
                  rotulo="Filtros"
                  texto={
                    aba.filtros
                      ? "Cabeçalho com filtro e ordenação."
                      : "Sem filtro."
                  }
                />
                <SecaoLista rotulo="Dependências" itens={dependencias} />
                <SecaoLista rotulo="Fontes" itens={fontes} />
              </div>
            </Collapse>

            <Collapse in={aberto}>
              <div className="dark:border-dark-600 mt-3 border-t border-gray-100 pt-3">
                <label className="block text-sm">
                  <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                    Como você quer ajustar esta aba?
                  </span>
                  <textarea
                    value={instrucao}
                    onChange={(e) => setInstrucao(e.target.value)}
                    rows={2}
                    placeholder="Ex.: adicione comparação com o ano anterior e uma coluna de margem percentual."
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
                    Aplicar
                  </Button>
                </div>
              </div>
            </Collapse>

            {!aberto && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setAberto(true)}
                  className="text-xs-plus h-8 gap-1.5 px-3"
                >
                  <SparklesIcon className="size-4" />
                  Ajustar com IA
                </Button>
                {temDetalhes && (
                  <button
                    type="button"
                    onClick={() => setDetalhes((d) => !d)}
                    aria-expanded={detalhes}
                    className="dark:text-dark-300 dark:hover:text-dark-100 text-xs-plus ms-auto font-medium text-gray-500 hover:text-gray-800"
                  >
                    {detalhes ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {edge && <DropIndicator edge={edge} gap="16px" />}
    </div>
  );
}

/** Uma coluna em "Ver detalhes": nome, tipo e o que a rege. */
function ColunaLinha({ coluna }: { coluna: PlanoColuna }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <span className="dark:text-dark-100 text-sm font-medium text-gray-700">
        {coluna.nome}
      </span>
      <span className="dark:text-dark-300 text-tiny text-gray-400">
        {ROTULO_COLUNA[coluna.tipo] ?? ROTULO_COLUNA.texto}
      </span>
      {coluna.descricao && (
        <span className="dark:text-dark-200 w-full text-sm text-gray-600">
          {coluna.descricao}
        </span>
      )}
      {coluna.formula && (
        <span className="dark:text-dark-200 w-full font-mono text-xs text-gray-600">
          {coluna.formula}
        </span>
      )}
      {coluna.validacao && (
        <span className="dark:text-dark-300 text-tiny w-full text-gray-500">
          Regra: {coluna.validacao}
        </span>
      )}
    </li>
  );
}

/**
 * Cálculos com a implementação à mostra.
 *
 * Só aqui a fórmula aparece — e em `font-mono`, para ficar claro que é a
 * tradução técnica da linha de cima, não outra coisa.
 */
function SecaoFormulas({
  rotulo,
  itens,
}: {
  rotulo: string;
  itens: PlanoCalculo[];
}) {
  const lista = itens.filter((i) => i.nome || i.logica);
  if (!lista.length) return null;
  return (
    <div>
      <RotuloSecao>{rotulo}</RotuloSecao>
      <ul className="flex flex-col gap-1.5">
        {lista.map((c, i) => (
          <li key={i}>
            <span className="dark:text-dark-200 text-sm text-gray-600">
              <span className="dark:text-dark-100 font-medium text-gray-700">
                {c.nome}
              </span>
              {c.logica ? ` — ${c.logica}` : ""}
            </span>
            {c.formula && (
              <span className="dark:text-dark-300 block font-mono text-xs text-gray-500">
                {c.formula}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rótulo de seção + texto. Some quando a aba não tem esse campo. */
function Secao({ rotulo, texto }: { rotulo: string; texto?: string }) {
  if (!texto?.trim()) return null;
  return (
    <div>
      <RotuloSecao>{rotulo}</RotuloSecao>
      <p className="dark:text-dark-200 text-sm text-gray-600">{texto}</p>
    </div>
  );
}

function SecaoLista({
  rotulo,
  itens,
  restante = 0,
}: {
  rotulo: string;
  itens?: string[];
  /** Quantos ficaram de fora do resumo — viram "e mais N". */
  restante?: number;
}) {
  const lista = (itens ?? []).map((i) => i.trim()).filter(Boolean);
  if (!lista.length) return null;
  return (
    <div>
      <RotuloSecao>{rotulo}</RotuloSecao>
      <ul className="dark:text-dark-200 list-disc space-y-1 ps-4 text-sm text-gray-600 marker:text-gray-300">
        {lista.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {restante > 0 && (
          <li className="dark:text-dark-300 list-none ps-0 text-gray-400">
            e mais {restante}
          </li>
        )}
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
