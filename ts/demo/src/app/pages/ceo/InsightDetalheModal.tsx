// Modal "Ver insight" — camada de aprofundamento do card, sem página nova.
// Abre com o que a listagem já trouxe (título, resumo, feedback) e busca sob
// demanda só o conteúdo completo: análise, evidências e fonte. Cada seção só
// aparece se existir — insights antigos não têm análise nem evidências, e
// nada é preenchido para "completar" o modal.

// Import Dependencies
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  HandThumbDownIcon as HandThumbDownSolidIcon,
  HandThumbUpIcon as HandThumbUpSolidIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Badge, Button, Skeleton } from "@/components/ui";
import {
  FILTRO_OPCOES,
  type Insight,
  type InsightCor,
  type InsightDetalhe,
  type AcaoSugeridaReuniao,
  type InsightFeedback,
} from "@/app/data/insights";
import { buscarInsightApi } from "@/services/api/insights";
import { useConversarSobreInsight } from "./useConversarSobreInsight";

// ----------------------------------------------------------------------

// Mesma correspondência severidade → cor do Badge dos cards.
const BADGE_COLOR: Record<InsightCor, "error" | "warning" | "success" | "neutral"> =
  {
    secondary: "error",
    warning: "warning",
    success: "success",
    light: "neutral",
  };

const ROTULO_SEVERIDADE = Object.fromEntries(
  FILTRO_OPCOES.map((o) => [o.value, o.label]),
) as Record<string, string>;

function dataPorExtenso(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("pt-BR", { dateStyle: "long" });
}

type Carga =
  | { estado: "carregando" }
  | { estado: "ok"; detalhe: InsightDetalhe }
  | { estado: "erro"; indisponivel: boolean };

function statusDe(e: unknown): number | null {
  if (e && typeof e === "object" && "statusCode" in e) {
    const s = (e as { statusCode?: unknown }).statusCode;
    return typeof s === "number" ? s : null;
  }
  return null;
}

export function InsightDetalheModal({
  insight,
  feedback: feedbackProp,
  onLike,
  onDislike,
  onClose,
  onIrParaInsights,
}: {
  /** Insight aberto (null = fechado). Vem da listagem, já com o resumo. */
  insight: Insight | null;
  /** Feedback atual — o MESMO estado do card, para os dois ficarem em sincronia. */
  feedback: InsightFeedback | undefined;
  onLike: () => void;
  onDislike: () => void;
  onClose: () => void;
  /**
   * Leva para a tela de Insights. Só é passado quando o modal foi aberto
   * FORA dela (ex.: pelas Notificações) — na própria tela, o botão não aparece.
   */
  onIrParaInsights?: () => void;
}) {
  // Durante a animação de saída o Dialog segue mostrando o último insight.
  const [ultimo, setUltimo] = useState<Insight | null>(insight);
  if (insight && insight !== ultimo) setUltimo(insight);
  const alvo = insight ?? ultimo;

  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  // Trocar de insight volta ao "carregando" — derivado no render, não num efeito.
  const [idVisto, setIdVisto] = useState<string | null>(null);
  if (insight && insight.id !== idVisto) {
    setIdVisto(insight.id);
    setCarga({ estado: "carregando" });
  }

  useEffect(() => {
    if (!insight) return;
    let vivo = true;
    buscarInsightApi(insight.id)
      .then((detalhe) => vivo && setCarga({ estado: "ok", detalhe }))
      .catch(
        (e) =>
          vivo &&
          setCarga({ estado: "erro", indisponivel: statusDe(e) === 404 }),
      );
    return () => {
      vivo = false;
    };
    // `insight` inteiro não entra: a lista re-renderiza o mesmo id com objeto
    // novo (ex.: feedback) e isso não deve refazer a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight?.id, tentativa]);

  const detalhe = carga.estado === "ok" ? carga.detalhe : null;
  const { conversar, ocupado } = useConversarSobreInsight();
  const pessoa =
    alvo?.liderado && alvo.liderado !== "Todos" ? alvo.liderado : null;
  const contexto: { termo: string; valor: string; nota?: string }[] = [];
  if (alvo?.liderado)
    contexto.push({
      termo: pessoa ? "Pessoa" : "Time",
      valor: pessoa ?? "Time inteiro",
    });
  if (alvo?.origem) contexto.push({ termo: "Origem", valor: alvo.origem });
  if (alvo?.direcionamento)
    contexto.push({
      termo: "Orientação relacionada",
      valor: alvo.direcionamento.nome,
      nota: "Orientou a análise; as conclusões vêm dos dados.",
    });

  // Sem o estado do card (aberto pelas Notificações), vale o voto que o
  // detalhe trouxe do servidor.
  const feedback = feedbackProp ?? detalhe?.meuFeedback;
  const respondeu = feedback != null;

  return (
    <Transition show={insight != null}>
      <Dialog onClose={onClose} className="relative z-100">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/50" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-4">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={clsx(
                "dark:bg-dark-700 flex h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl",
                alvo?.acaoSugerida ? "max-w-xl" : "max-w-3xl",
              )}
            >
              {alvo?.acaoSugerida ? (
                <DetalheComReuniao
                  insight={alvo}
                  acao={alvo.acaoSugerida}
                  onClose={onClose}
                />
              ) : alvo && (
                <>
                  {/* Header fixo */}
                  <div className="dark:border-dark-500 flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          color="primary"
                          variant="soft"
                          className="rounded-full text-[10px]"
                        >
                          Insight
                        </Badge>
                        <Badge
                          color={BADGE_COLOR[alvo.cor]}
                          variant="soft"
                          className="rounded-full text-[10px]"
                        >
                          {alvo.tipo}
                          {ROTULO_SEVERIDADE[alvo.cor]
                            ? ` · ${ROTULO_SEVERIDADE[alvo.cor]}`
                            : ""}
                        </Badge>
                      </div>
                      <DialogTitle className="dark:text-dark-50 mt-2 text-lg font-semibold text-gray-800">
                        {alvo.titulo}
                      </DialogTitle>
                      <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
                        Identificado em {dataPorExtenso(alvo.criadoEm, alvo.data)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar"
                      className="dark:hover:bg-dark-500 dark:text-dark-300 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
                    >
                      <XMarkIcon className="size-5" />
                    </button>
                  </div>

                  {/* Corpo com scroll interno */}
                  <div className="custom-scrollbar grow space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                    <Secao titulo="Resumo">
                      <p className="dark:text-dark-100 text-sm text-gray-700">
                        {alvo.descricao}
                      </p>
                    </Secao>

                    {carga.estado === "carregando" ? (
                      <div className="space-y-2" aria-busy="true" aria-live="polite">
                        <span className="sr-only">Carregando a análise…</span>
                        <Skeleton className="h-3 w-24 rounded-sm" />
                        <Skeleton className="h-3 w-full rounded-sm" />
                        <Skeleton className="h-3 w-full rounded-sm" />
                        <Skeleton className="h-3 w-2/3 rounded-sm" />
                      </div>
                    ) : carga.estado === "erro" ? (
                      <div
                        role="alert"
                        className="dark:border-dark-500 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <p className="dark:text-dark-100 text-sm text-gray-700">
                          {carga.indisponivel
                            ? "Este insight não está mais disponível."
                            : "Não foi possível carregar este insight."}
                        </p>
                        {!carga.indisponivel && (
                          <Button
                            variant="outlined"
                            className="mt-2 h-8 rounded-lg text-xs"
                            onClick={() => {
                              setCarga({ estado: "carregando" });
                              setTentativa((n) => n + 1);
                            }}
                          >
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {detalhe?.analise && (
                          <Secao titulo="Análise">
                            <div className="dark:text-dark-100 space-y-3 text-sm text-gray-700">
                              {detalhe.analise
                                .split(/\n\s*\n/)
                                .map((par) => par.trim())
                                .filter(Boolean)
                                .map((par, i) => (
                                  <p key={i} className="whitespace-pre-line">
                                    {par}
                                  </p>
                                ))}
                            </div>
                          </Secao>
                        )}

                        {detalhe &&
                          (detalhe.evidencias.length > 0 || detalhe.fonte) && (
                            <Secao titulo="Evidências">
                              {detalhe.evidencias.length > 0 && (
                                <ul className="space-y-2">
                                  {detalhe.evidencias.map((e, i) => (
                                    <li key={i}>
                                      <blockquote className="dark:border-dark-400 dark:text-dark-200 border-l-2 border-gray-300 pl-3 text-sm text-gray-600 italic">
                                        “{e}”
                                      </blockquote>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {detalhe.fonte && (
                                <p
                                  className={clsx(
                                    "dark:text-dark-300 text-xs-plus text-gray-500",
                                    detalhe.evidencias.length > 0 && "mt-3",
                                  )}
                                >
                                  Fonte:{" "}
                                  <span className="dark:text-dark-100 font-medium text-gray-700">
                                    {detalhe.fonte.titulo}
                                  </span>{" "}
                                  · {detalhe.fonte.categoria} ·{" "}
                                  {dataPorExtenso(detalhe.fonte.data, "")}
                                </p>
                              )}
                            </Secao>
                          )}
                      </>
                    )}

                    {contexto.length > 0 && (
                      <Secao titulo="Contexto">
                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                          {contexto.map((c) => (
                            <div key={c.termo}>
                              <dt className="dark:text-dark-300 text-xs text-gray-400">
                                {c.termo}
                              </dt>
                              <dd className="dark:text-dark-100 text-sm text-gray-700">
                                {c.valor}
                              </dd>
                              {c.nota && (
                                <dd className="dark:text-dark-400 text-tiny mt-0.5 text-gray-400">
                                  {c.nota}
                                </dd>
                              )}
                            </div>
                          ))}
                        </dl>
                      </Secao>
                    )}
                  </div>

                  {/* Rodapé: feedback + fechar */}
                  <div className="dark:border-dark-500 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 sm:px-6">
                    {respondeu ? (
                      <span
                        role="status"
                        className="dark:text-dark-300 flex items-center gap-1.5 text-sm text-gray-500"
                      >
                        {feedback.util ? (
                          <HandThumbUpSolidIcon className="text-primary-500 size-4" aria-hidden />
                        ) : (
                          <HandThumbDownSolidIcon className="size-4" aria-hidden />
                        )}
                        Obrigado pelo feedback.
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="dark:text-dark-200 text-sm text-gray-600">
                          Este insight foi útil?
                        </span>
                        <Button
                          variant="outlined"
                          isIcon
                          className="size-8 rounded-lg"
                          onClick={onLike}
                          aria-label="Marcar insight como útil"
                          title="Útil"
                        >
                          <HandThumbUpIcon className="size-4" />
                        </Button>
                        <Button
                          variant="outlined"
                          isIcon
                          className="size-8 rounded-lg"
                          onClick={onDislike}
                          aria-label="Marcar insight como não útil"
                          title="Não útil"
                        >
                          <HandThumbDownIcon className="size-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                      {/* Mesma ação do menu ••• do card. Fecha o modal para o
                          painel do assistente não ficar atrás do overlay. */}
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          void conversar(alvo, detalhe);
                          onClose();
                        }}
                        className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1.5 text-sm font-medium hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                      >
                        <ChatBubbleLeftRightIcon className="size-4" />
                        Conversar com o assistente
                      </button>
                      {onIrParaInsights && (
                        <button
                          type="button"
                          onClick={onIrParaInsights}
                          className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        >
                          <ArrowTopRightOnSquareIcon className="size-4" />
                          Ir para Insights
                        </button>
                      )}
                      <Button variant="outlined" className="rounded-lg" onClick={onClose}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------
// Variante com AÇÃO SUGERIDA (reunião): resumo + card da reunião proposta, e o
// rodapé de agendamento no lugar do feedback. No protótipo, agendar é
// simulado com toast — nada é gravado nem vai para uma agenda real.

function DetalheComReuniao({
  insight,
  acao,
  onClose,
}: {
  insight: Insight;
  acao: AcaoSugeridaReuniao;
  onClose: () => void;
}) {
  const tituloReuniao = `${acao.titulo} · ${acao.duracao}`;

  const agendar = () => {
    toast.success("Reunião agendada", {
      description: `“${tituloReuniao}” foi marcada na sua agenda para amanhã, às 10:00, com ${listaPorExtenso(acao.areas)}.`,
    });
    onClose();
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              color="primary"
              variant="soft"
              className="rounded-full text-[10px]"
            >
              Insight
            </Badge>
            <Badge
              color={BADGE_COLOR[insight.cor]}
              variant="soft"
              className="rounded-full text-[10px]"
            >
              {insight.tipo}
              {ROTULO_SEVERIDADE[insight.cor]
                ? ` · ${ROTULO_SEVERIDADE[insight.cor]}`
                : ""}
            </Badge>
          </div>
          <DialogTitle className="dark:text-dark-50 mt-3 text-lg font-semibold text-gray-800">
            {insight.titulo}
          </DialogTitle>
          <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
            Identificado em {dataPorExtenso(insight.criadoEm, insight.data)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="dark:hover:bg-dark-500 dark:text-dark-300 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>

      <div className="custom-scrollbar grow space-y-5 overflow-y-auto px-6 pt-5 pb-6">
        <Secao titulo="Resumo">
          <p className="dark:text-dark-100 text-sm text-gray-700">
            {insight.descricao}
          </p>
        </Secao>

        <Secao titulo="Ação sugerida">
          <div className="border-primary-200 bg-primary-50/60 dark:border-primary-500/30 dark:bg-primary-500/10 flex gap-3 rounded-xl border p-4">
            <span className="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300 grid size-9 shrink-0 place-items-center rounded-lg">
              <CalendarDaysIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="dark:text-dark-50 text-sm font-semibold text-gray-800">
                {tituloReuniao}
              </p>
              <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">
                {acao.descricao}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {acao.areas.map((area) => (
                  <span
                    key={area}
                    className="dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-700"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Secao>
      </div>

      <div className="dark:border-dark-500 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <Button variant="outlined" className="rounded-lg" onClick={onClose}>
            Fechar
          </Button>
          <Button color="primary" className="gap-2 rounded-lg" onClick={agendar}>
            <CalendarDaysIcon className="size-4.5" />
            Agendar reunião
          </Button>
        </div>
      </div>
    </>
  );
}

/** ["A", "B", "C"] → "A, B e C". */
function listaPorExtenso(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="dark:text-dark-200 mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
