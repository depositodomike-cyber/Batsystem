// Notificações do header. Cada item é uma `Notificacao` com um `tipo`; hoje a
// única origem real são os INSIGHTS que o usuário ainda não viu (sem leitura
// dele no backend), e esses levam a identificação [Insight]. Notificações de
// outros tipos, quando existirem, entram pelo mesmo formato SEM o badge.
// Clicar num insight marca como lido e abre o MESMO modal de detalhe da tela
// de Insights na tela em que o usuário está — sem navegar. O modal tem um
// botão "Ir para Insights" para quem quiser ir até a tela.

// Import Dependencies
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import {
  ArchiveBoxXMarkIcon,
  Cog6ToothIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

// Local Imports
import {
  Avatar,
  type AvatarProps,
  AvatarDot,
  Badge,
  Button,
} from "@/components/ui";
import { useThemeContext } from "@/app/contexts/theme/context";
import {
  sugerirDirecionamento,
  type Insight,
  type InsightCor,
  type InsightFeedback,
} from "@/app/data/insights";
import {
  getProductCodeFromPath,
  userSettingsPath,
} from "@/app/navigation/ceoOs";
import { InsightDetalheModal } from "@/app/pages/ceo/InsightDetalheModal";
import { FeedbackNegativoModal } from "@/app/pages/ceo/InsightFeedbackNegativoModal";
import { usePodeGerenciarDirecionadores } from "@/app/pages/ceo/usePodeGerenciarDirecionadores";
import {
  listarInsightsNaoLidosApi,
  salvarFeedbackInsightApi,
  marcarInsightLidoApi,
  marcarTodosInsightsLidosApi,
} from "@/services/api/insights";
import AlarmIcon from "@/assets/dualicons/alarm.svg?react";
import GirlEmptyBox from "@/assets/illustrations/girl-empty-box.svg?react";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

// Só o Business Partner tem página de Insights (ver `insightsPages` em
// ceoRoutes.tsx) — o clique leva sempre para lá, qualquer que seja o produto
// aberto.
const INSIGHTS_PATH = "/behuman/insights";

// Intervalo de atualização do sino enquanto a página está aberta.
const POLL_MS = 60_000;

// Mesma correspondência severidade → cor do Badge da página de Insights.
const COR_AVATAR: Record<InsightCor, AvatarProps["initialColor"]> = {
  secondary: "error",
  warning: "warning",
  success: "success",
  light: "neutral",
};

/**
 * Tempo relativo curto. As mesmas regras de `quandoFoi` em CriacoesLista.tsx,
 * repetidas de propósito pelo mesmo motivo de lá.
 */
function quandoFoi(iso?: string, fallback = ""): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Um item da central. `tipo` decide o badge e o texto da ação. */
interface Notificacao {
  id: string;
  tipo: "insight";
  titulo: string;
  descricao: string;
  /** ISO; sem ele, cai em `dataTexto`. */
  criadoEm?: string;
  dataTexto: string;
  cor: AvatarProps["initialColor"];
  /** Linha extra de contexto (ex.: o direcionamento relacionado). */
  contexto?: string;
}

function deInsight(i: Insight): Notificacao {
  return {
    id: i.id,
    tipo: "insight",
    titulo: i.titulo,
    descricao: i.descricao,
    criadoEm: i.criadoEm,
    dataTexto: i.data,
    cor: COR_AVATAR[i.cor],
    ...(i.direcionamento
      ? { contexto: `Relacionado à orientação “${i.direcionamento.nome}”` }
      : {}),
  };
}

interface NotificationItemProps {
  data: Notificacao;
  onOpen: (item: Notificacao) => void;
  onArchive: (id: string) => void;
}

export function Notifications() {
  const disabled = isFeatureTemporarilyDisabled("notifications");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [itens, setItens] = useState<Insight[]>([]);
  const [total, setTotal] = useState(0);

  // Modal de detalhe aberto a partir do sino, na tela atual. O feedback dado
  // aqui fica neste estado (o modal usa o do servidor enquanto não houver).
  const [aberto, setAberto] = useState<Insight | null>(null);
  const [feedback, setFeedback] = useState<InsightFeedback | undefined>();
  const [negativoPara, setNegativoPara] = useState<Insight | null>(null);
  const podeOrientar = usePodeGerenciarDirecionadores();

  // Falha de rede é silenciosa: o sino mantém o que já mostrava.
  const carregar = useCallback(() => {
    listarInsightsNaoLidosApi()
      .then((r) => {
        setItens(r.insights);
        setTotal(r.total);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (disabled) return;
    carregar();
    const t = window.setInterval(carregar, POLL_MS);
    return () => window.clearInterval(t);
  }, [disabled, carregar]);

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label="Notificações"
        title="Notificações"
        className={clsx(
          "relative flex size-9 items-center justify-center rounded-lg outline-hidden",
          DISABLED_MENU_CLASS,
        )}
      >
        <AlarmIcon className="dark:text-dark-100 size-6 text-gray-900" />
      </span>
    );
  }

  // Remove da lista na hora e avisa o backend; se falhar, recarrega do servidor.
  const marcarLido = (id: string) => {
    setItens((l) => l.filter((i) => i.id !== id));
    setTotal((n) => Math.max(0, n - 1));
    marcarInsightLidoApi(id).catch(carregar);
  };

  const abrirDetalhe = (insight: Insight) => {
    setFeedback(undefined);
    setAberto(insight);
  };

  const curtir = (insight: Insight) => {
    setFeedback({ util: true });
    salvarFeedbackInsightApi(insight.id, { util: true }).catch(() => {
      setFeedback(undefined);
      toast.error("Não foi possível registrar o feedback.");
    });
  };

  const marcarTodos = () => {
    setItens([]);
    setTotal(0);
    marcarTodosInsightsLidosApi().catch(carregar);
  };

  return (
    <>
      <Popover className="relative flex">
        <PopoverButton
          as={Button}
          variant="flat"
          isIcon
          className="relative size-9 rounded-lg"
          onClick={carregar}
          aria-label="Notificações"
        >
          <AlarmIcon className="dark:text-dark-100 size-6 text-gray-900" />
          {total > 0 && (
            <AvatarDot
              color="error"
              isPing
              className="top-0 ltr:right-0 rtl:left-0"
            />
          )}
        </PopoverButton>
        <Transition
          enter="transition ease-out"
          enterFrom="opacity-0 translate-y-2"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-2"
        >
          <PopoverPanel
            anchor={{ to: "bottom end", gap: 8 }}
            className="border-gray-150 shadow-soft dark:border-dark-800 dark:bg-dark-700 dark:shadow-soft-dark z-70 mx-4 flex h-[min(32rem,calc(100vh-6rem))] w-[calc(100vw-2rem)] flex-col rounded-lg border bg-white sm:m-0 sm:w-80"
          >
            {({ close }: { close: () => void }) => (
              <div className="flex grow flex-col overflow-hidden">
                <div className="dark:bg-dark-800 rounded-t-lg bg-gray-100">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <h3 className="dark:text-dark-100 font-medium text-gray-800">
                        Notificações
                      </h3>
                      {total > 0 && (
                        <Badge
                          color="primary"
                          className="h-5 rounded-full px-1.5"
                          variant="soft"
                        >
                          {total}
                        </Badge>
                      )}
                    </div>
                    {/* Oculto temporariamente — ver `notificationsSettings`. */}
                    {!isFeatureTemporarilyDisabled("notificationsSettings") && (
                      <Button
                        component={Link}
                        to="/settings/notifications"
                        className="size-7 rounded-lg ltr:-mr-1.5 rtl:-ml-1.5"
                        isIcon
                        variant="flat"
                        onClick={close}
                      >
                        <Cog6ToothIcon className="size-4.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {itens.length > 0 ? (
                  <div className="custom-scrollbar grow space-y-1 overflow-x-hidden overflow-y-auto p-2">
                    {itens.map(deInsight).map((item) => (
                      <NotificationItem
                        key={item.id}
                        data={item}
                        onArchive={marcarLido}
                        onOpen={(n) => {
                          const insight = itens.find((i) => i.id === n.id);
                          marcarLido(n.id);
                          close();
                          if (insight) abrirDetalhe(insight);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty />
                )}
                {itens.length > 0 && (
                  <div className="dark:bg-dark-800 shrink-0 overflow-hidden rounded-b-lg bg-gray-100">
                    <Button
                      className="w-full rounded-t-none"
                      onClick={marcarTodos}
                    >
                      <span>Marcar todas como lidas</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>

      {/* Fora do Popover: o painel fecha ao abrir o modal, e o modal fica. */}
      <InsightDetalheModal
        insight={aberto}
        feedback={feedback}
        onLike={() => aberto && curtir(aberto)}
        onDislike={() => aberto && setNegativoPara(aberto)}
        onClose={() => setAberto(null)}
        onIrParaInsights={() => {
          setAberto(null);
          navigate(INSIGHTS_PATH);
        }}
      />
      <FeedbackNegativoModal
        insight={negativoPara}
        podeOrientar={podeOrientar}
        onClose={() => setNegativoPara(null)}
        onRegistrado={(_, fb) => setFeedback(fb)}
        onAdicionarOrientacao={(insight, motivo) => {
          setNegativoPara(null);
          setAberto(null);
          navigate(
            userSettingsPath(getProductCodeFromPath(pathname), "orientador"),
            { state: { sugestao: sugerirDirecionamento(insight, motivo) } },
          );
        }}
      />
    </>
  );
}

function Empty() {
  const { primaryColorScheme: primary, darkColorScheme: dark } =
    useThemeContext();
  return (
    <div className="grid grow place-items-center text-center">
      <div className="">
        <GirlEmptyBox
          className="mx-auto w-40"
          style={
            {
              "--primary": primary[500],
              "--dark": dark[500],
            } as React.CSSProperties
          }
        />
        <div className="mt-6">
          <p>Nenhuma notificação nova por enquanto</p>
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ data, onOpen, onArchive }: NotificationItemProps) {
  return (
    <div className="group dark:hover:bg-dark-600 flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-gray-100">
      <button
        type="button"
        onClick={() => onOpen(data)}
        className="flex min-w-0 flex-1 gap-3 text-left outline-hidden"
      >
        <Avatar
          size={10}
          initialColor={data.cor}
          classNames={{ root: "shrink-0", display: "rounded-lg" }}
        >
          <SparklesIcon className="size-4.5" />
        </Avatar>
        <div className="min-w-0">
          {data.tipo === "insight" && (
            <Badge
              color="primary"
              variant="soft"
              className="mb-1 h-5 rounded-full px-2 text-[10px]"
            >
              Insight
            </Badge>
          )}
          <p className="dark:text-dark-100 truncate font-medium text-gray-800">
            {data.titulo}
          </p>
          <div className="mt-0.5 line-clamp-2 text-xs">{data.descricao}</div>
          {data.contexto && (
            <div className="dark:text-dark-300 mt-0.5 truncate text-xs text-gray-400">
              {data.contexto}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="dark:text-dark-300 text-gray-400">
              {quandoFoi(data.criadoEm, data.dataTexto)}
            </span>
            {data.tipo === "insight" && (
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                Ver insight
              </span>
            )}
          </div>
        </div>
      </button>
      <Button
        variant="flat"
        isIcon
        onClick={() => onArchive(data.id)}
        title="Marcar como lida"
        aria-label="Marcar como lida"
        className="size-7 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <ArchiveBoxXMarkIcon className="size-4" />
      </Button>
    </div>
  );
}
