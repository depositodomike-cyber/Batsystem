// ----------------------------------------------------------------------
// Painel de contexto do Grafo — o passo do meio do progressive disclosure:
//
//   grafo → entidade/relação → contexto → conteúdos → documento (.md)
//
// É um OVERLAY dentro do container do canvas, nunca um irmão em flex. Se ele
// encolhesse o canvas, o ResizeObserver de MemoriaGrafo dispararia `resize()` →
// `preaquecer()` (3000 passos de física) e o grafo daria um salto a cada
// abertura. Como overlay, `wrap.clientWidth` não muda e nada é recalculado.
//
// Fecha o ciclo reusando o que já existe: clicar num conteúdo abre o mesmo
// NotaMemoriaModal da Lista e do Grafo.
// ----------------------------------------------------------------------

import { useEffect, useMemo, useState, type ElementType } from "react";
import clsx from "clsx";
import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  FilmIcon,
  MicrophoneIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
  UserIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { Badge, Button, Spinner } from "@/components/ui";
import { Combobox } from "@/components/shared/form/StyledCombobox";
import type { ItemContexto } from "./memoria-inventario";
import type { EntKind } from "./memoria-grafo-modelo";

// Mesma tabela de ICONE_POR_TIPO de MemoriaLista.tsx. Duplicada de propósito:
// lá ela é um const de módulo não exportado, e extraí-la exigiria editar
// MemoriaLista — que nesta evolução tem de ficar intocada.
const ICONE_POR_TIPO: Record<string, ElementType> = {
  Análise: ChartBarIcon,
  Apresentação: PresentationChartBarIcon,
  Áudio: SpeakerWaveIcon,
  Conversa: ChatBubbleLeftRightIcon,
  Corte: FilmIcon,
  Dashboard: ChartBarIcon,
  "E-mail": EnvelopeIcon,
  Imagem: PhotoIcon,
  Pessoa: UserIcon,
  Reunião: UserGroupIcon,
  Slack: ChatBubbleLeftRightIcon,
  Transcrição: MicrophoneIcon,
  Vídeo: FilmIcon,
};

/** Vizinho de uma entidade, já resolvido no instante do clique. */
export interface RelacaoVizinha {
  id: string;
  titulo: string;
  rotulo: string;
  /** Quantos conteúdos sustentam a relação. */
  peso: number;
  /**
   * Relação declarada pelo usuário. É a única removível: uma relação de
   * co-ocorrência só sai editando os documentos que a produzem.
   */
  manual?: boolean;
}

/**
 * O que está selecionado no canvas. É SEMPRE dado plano copiado no clique —
 * nunca um GNode vivo, que a simulação muta 60×/s.
 */
export type Selecao =
  | {
      tipo: "entidade";
      id: string;
      titulo: string;
      rotulo: string;
      kind: EntKind;
      /** Só pessoa: caminho do .md próprio, para o botão "Abrir nota". */
      notaPath?: string;
      relacoes: RelacaoVizinha[];
      conteudos: string[];
    }
  | {
      tipo: "relacao";
      aId: string;
      aTitulo: string;
      bId: string;
      bTitulo: string;
      fontes: string[];
    };

const TETO_LISTA = 12;

/**
 * "4 reuniões · 2 documentos" — agrega os conteúdos pelo tipo do inventário.
 *
 * Quando todos são do mesmo tipo genérico (o caso de um vault importado, onde
 * tudo cai em "Nota"), dizer "18 notas" não informa nada: vira "18 conteúdos
 * relacionados", que é o que o número de fato significa.
 */
function resumirPorTipo(itens: ItemContexto[]): string {
  const contagem = new Map<string, number>();
  for (const i of itens) contagem.set(i.tipo, (contagem.get(i.tipo) ?? 0) + 1);
  if (contagem.size <= 1 && (contagem.has("Nota") || contagem.size === 0)) {
    return `${itens.length} ${itens.length === 1 ? "conteúdo relacionado" : "conteúdos relacionados"}`;
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, n]) => `${n} ${n === 1 ? tipo.toLowerCase() : plural(tipo)}`)
    .join(" · ");
}

// Plural explícito dos rótulos que tipoDoItem produz — regra de morfologia
// erraria justamente os casos que mais aparecem ("e-mail", "slack").
const PLURAL: Record<string, string> = {
  análise: "análises",
  apresentação: "apresentações",
  artigo: "artigos",
  áudio: "áudios",
  carrossel: "carrosséis",
  conversa: "conversas",
  corte: "cortes",
  dashboard: "dashboards",
  documento: "documentos",
  "e-mail": "e-mails",
  imagem: "imagens",
  nota: "notas",
  pessoa: "pessoas",
  reunião: "reuniões",
  slack: "mensagens do Slack",
  texto: "textos",
  transcrição: "transcrições",
  vídeo: "vídeos",
};

function plural(tipo: string): string {
  const t = tipo.toLowerCase();
  return PLURAL[t] ?? t + "s";
}

/** Agrupa os vizinhos por tipo, na ordem Pessoas → Projetos → Tags. */
const ORDEM_ROTULO = ["Pessoa", "Projeto", "Tag"];
function agruparPorRotulo(
  relacoes: RelacaoVizinha[],
): [string, RelacaoVizinha[]][] {
  const grupos = new Map<string, RelacaoVizinha[]>();
  for (const r of relacoes) {
    const chave = r.rotulo || "Relacionados";
    const atual = grupos.get(chave);
    if (atual) atual.push(r);
    else grupos.set(chave, [r]);
  }
  return [...grupos.entries()]
    .map(([rotulo, itens]): [string, RelacaoVizinha[]] => [
      // Plural no cabeçalho do grupo: "Tags", não "Tag".
      itens.length === 1 ? rotulo : rotulo + "s",
      itens.slice(0, TETO_LISTA),
    ])
    .sort(
      (a, b) =>
        ORDEM_ROTULO.findIndex((o) => a[0].startsWith(o)) -
        ORDEM_ROTULO.findIndex((o) => b[0].startsWith(o)),
    );
}

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="dark:text-dark-300 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
          {titulo}
        </h4>
        {acao}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="dark:text-dark-300 text-tiny text-gray-400">{children}</p>
  );
}

/** Uma tag que pode virar destino de um novo relacionamento. */
export interface TagDisponivel {
  id: string;
  titulo: string;
}

/**
 * Escolher a tag a relacionar. Combobox do design system (busca fuzzy), aberto
 * só quando o usuário pede — a lista pode ter dezenas de tags e ocupar o painel
 * inteiro à toa.
 */
function SeletorDeTag({
  opcoes,
  onEscolher,
  onCancelar,
  ocupado,
}: {
  opcoes: TagDisponivel[];
  onEscolher: (t: TagDisponivel) => void;
  onCancelar: () => void;
  ocupado: boolean;
}) {
  return (
    <div className="mb-2 px-2">
      <Combobox
        data={opcoes}
        displayField="titulo"
        searchFields={["titulo"]}
        value={null}
        onChange={(t: TagDisponivel | null) => t && onEscolher(t)}
        placeholder="Buscar uma tag…"
        disabled={ocupado}
        highlight
        inputProps={{
          autoFocus: true,
          onKeyDown: (e: React.KeyboardEvent) => {
            // Esc fecha o seletor sem fechar o painel inteiro.
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancelar();
            }
          },
        }}
      />
    </div>
  );
}

/** Linha de conteúdo — mesma gramática visual de LinhaNota (MemoriaLista). */
function LinhaConteudo({
  item,
  onAbrir,
}: {
  item: ItemContexto;
  onAbrir: () => void;
}) {
  const Icone = ICONE_POR_TIPO[item.tipo] ?? DocumentTextIcon;
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="dark:hover:bg-dark-600 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors hover:bg-gray-50"
      >
        <span className="dark:bg-dark-600 dark:text-dark-200 grid size-7 shrink-0 place-items-center rounded-md bg-gray-100 text-gray-500">
          <Icone className="size-4 stroke-[1.5]" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="dark:text-dark-100 block truncate text-xs-plus font-medium text-gray-800"
            title={item.titulo}
          >
            {item.titulo}
          </span>
          <span className="dark:text-dark-300 block truncate text-tiny text-gray-400">
            {item.tipo}
            {item.origem && ` · ${item.origem}`}
          </span>
        </span>
      </button>
    </li>
  );
}

interface Props {
  selecao: Selecao | null;
  /** Inventário indexado por path — o mesmo objeto que a Lista renderiza. */
  itensPorPath: Map<string, ItemContexto>;
  onFechar: () => void;
  /** Navega para outra entidade sem sair do canvas. */
  onIrPara: (id: string) => void;
  /** Abre o .md no NotaMemoriaModal existente. */
  onAbrirNota: (path: string, titulo: string) => void;
  /** Tags que podem virar destino de um novo relacionamento. */
  tagsDisponiveis: TagDisponivel[];
  /** Grava a relação no vault. Resolve quando o arquivo já está salvo. */
  onRelacionar: (alvo: TagDisponivel) => Promise<void>;
  /** Desfaz uma relação criada à mão. */
  onDesrelacionar: (alvo: RelacaoVizinha) => Promise<void>;
  /** `false` quando o Repositório está como cópia somente leitura. */
  podeEscrever: boolean;
}

export function GrafoPainelContexto({
  selecao,
  itensPorPath,
  onFechar,
  onIrPara,
  onAbrirNota,
  tagsDisponiveis,
  onRelacionar,
  onDesrelacionar,
  podeEscrever,
}: Props) {
  // Guarda o id do nó para o qual o seletor foi aberto, em vez de um booleano:
  // ao trocar de nó ele deixa de bater e o seletor some sozinho, sem um effect
  // que sincronize estado (que dispararia renders em cascata).
  const [relacionandoPara, setRelacionandoPara] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const idAtual = selecao?.tipo === "entidade" ? selecao.id : null;
  const jaRelacionados =
    selecao?.tipo === "entidade" ? selecao.relacoes : undefined;
  // Não oferece a própria tag nem as que já estão ligadas.
  const opcoes = useMemo(() => {
    const fora = new Set(jaRelacionados?.map((r) => r.id));
    return tagsDisponiveis.filter((t) => t.id !== idAtual && !fora.has(t.id));
  }, [tagsDisponiveis, idAtual, jaRelacionados]);

  const relacionando = relacionandoPara !== null && relacionandoPara === idAtual;
  useEffect(() => {
    if (!selecao) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecao, onFechar]);

  if (!selecao) return null;

  const paths = selecao.tipo === "entidade" ? selecao.conteudos : selecao.fontes;
  const conteudos = paths
    .map((p) => itensPorPath.get(p))
    .filter((i): i is ItemContexto => !!i);

  const titulo =
    selecao.tipo === "entidade"
      ? selecao.titulo
      : `${selecao.aTitulo} × ${selecao.bTitulo}`;

  return (
    <aside
      className="dark:bg-dark-700 dark:border-dark-600 absolute inset-y-0 end-0 z-20 flex w-full max-w-[20rem] flex-col border-s border-gray-200 bg-white shadow-xl"
      aria-label="Contexto"
    >
      <div className="dark:border-dark-600 flex items-start gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3
            className="dark:text-dark-50 truncate text-sm font-semibold text-gray-800"
            title={titulo}
          >
            {titulo}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {selecao.tipo === "entidade" ? (
              <Badge variant="soft" color="neutral" className="text-tiny">
                {selecao.rotulo}
              </Badge>
            ) : (
              <Badge variant="soft" color="neutral" className="text-tiny">
                Relação
              </Badge>
            )}
            {conteudos.length > 0 && (
              <span className="dark:text-dark-300 text-tiny text-gray-400">
                {resumirPorTipo(conteudos)}
              </span>
            )}
          </div>
        </div>
        <Button
          isIcon
          variant="flat"
          onClick={onFechar}
          className="size-7 shrink-0 rounded-full"
          aria-label="Fechar contexto"
        >
          <XMarkIcon className="size-4" />
        </Button>
      </div>

      <div className="dark:divide-dark-600 flex-1 divide-y divide-gray-200 overflow-y-auto">
        {selecao.tipo === "entidade" && (
          <Secao
            titulo="Relacionamentos"
            acao={
              <Button
                variant="flat"
                onClick={() =>
                  setRelacionandoPara(relacionando ? null : idAtual)
                }
                disabled={!podeEscrever || ocupado || opcoes.length === 0}
                title={
                  !podeEscrever
                    ? "O Repositório está aberto como cópia somente leitura — não dá para gravar."
                    : opcoes.length === 0
                      ? "Não há outra tag para relacionar."
                      : "Relacionar com outra tag"
                }
                className="h-6 gap-1 px-1.5 text-tiny"
              >
                {ocupado ? (
                  <Spinner className="size-3" />
                ) : (
                  <PlusIcon className="size-3.5" />
                )}
                Relacionar
              </Button>
            }
          >
            {relacionando && (
              <SeletorDeTag
                opcoes={opcoes}
                ocupado={ocupado}
                onCancelar={() => setRelacionandoPara(null)}
                onEscolher={async (t) => {
                  setOcupado(true);
                  try {
                    await onRelacionar(t);
                    setRelacionandoPara(null);
                  } finally {
                    setOcupado(false);
                  }
                }}
              />
            )}
            {selecao.relacoes.length === 0 ? (
              <Vazio>Ainda sem relações registradas.</Vazio>
            ) : (
              // Agrupado por tipo: o badge repetido em toda linha vira ruído, e
              // ler "Tags: A, B, C" diz mais do que uma lista achatada.
              agruparPorRotulo(selecao.relacoes).map(([rotulo, itens]) => (
                <div key={rotulo} className="mb-2 last:mb-0">
                  <p className="dark:text-dark-300 mb-0.5 px-2 text-tiny text-gray-400">
                    {rotulo}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {itens.map((r) => (
                      <li key={r.id} className="group/rel relative">
                        <button
                          type="button"
                          onClick={() => onIrPara(r.id)}
                          className="dark:hover:bg-dark-600 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-gray-50"
                        >
                          <span
                            className="dark:text-dark-100 min-w-0 flex-1 truncate text-xs-plus text-gray-700"
                            title={r.titulo}
                          >
                            {r.titulo}
                          </span>
                          <span
                            className={clsx(
                              "dark:text-dark-300 shrink-0 text-tiny text-gray-400",
                              // Some no hover para dar lugar ao × sem empurrar
                              // o título.
                              r.manual && podeEscrever && "group-hover/rel:invisible",
                            )}
                            title={`${r.peso} ${r.peso === 1 ? "conteúdo em comum" : "conteúdos em comum"}`}
                          >
                            {r.peso}
                          </span>
                        </button>
                        {r.manual && podeEscrever && (
                          <button
                            type="button"
                            aria-label={`Remover a relação com ${r.titulo}`}
                            title="Remover esta relação"
                            disabled={ocupado}
                            onClick={async () => {
                              setOcupado(true);
                              try {
                                await onDesrelacionar(r);
                              } finally {
                                setOcupado(false);
                              }
                            }}
                            className="dark:text-dark-300 dark:hover:text-dark-50 absolute end-1.5 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700 group-hover/rel:block"
                          >
                            <XMarkIcon className="size-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Secao>
        )}

        <Secao titulo="Conteúdos relacionados">
          {conteudos.length === 0 ? (
            <Vazio>Nenhum conteúdo neste contexto.</Vazio>
          ) : (
            <>
              <ul className="flex flex-col gap-0.5">
                {conteudos.slice(0, TETO_LISTA).map((item) => (
                  <LinhaConteudo
                    key={item.path}
                    item={item}
                    onAbrir={() => onAbrirNota(item.path, item.titulo)}
                  />
                ))}
              </ul>
              {conteudos.length > TETO_LISTA && (
                <p className="dark:text-dark-300 mt-2 px-2 text-tiny text-gray-400">
                  + {conteudos.length - TETO_LISTA} outros
                </p>
              )}
            </>
          )}
        </Secao>
      </div>

      {selecao.tipo === "entidade" && selecao.notaPath && (
        <div className="dark:border-dark-600 border-t border-gray-200 px-4 py-3">
          <Button
            variant="outlined"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={() => onAbrirNota(selecao.notaPath!, selecao.titulo)}
          >
            <DocumentTextIcon className="size-4" />
            Abrir nota
          </Button>
        </div>
      )}
    </aside>
  );
}
