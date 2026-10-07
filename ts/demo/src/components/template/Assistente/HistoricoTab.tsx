// Aba Histórico do painel: conversas persistidas agrupadas por período. Clicar
// carrega a conversa dentro do próprio painel, sem sair da tela.
//
// Histórico ÚNICO: conversas com e sem agente ficam na mesma lista. O agente
// aparece como metadado discreto sob o título, e o filtro no topo recorta a
// lista (Todas / Assistente / Com agentes / um agente) — não existe histórico
// separado por agente.
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
  Transition,
} from "@headlessui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { useAssistente } from "@/app/contexts/assistente/context";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { useAgentes } from "@/app/contexts/agentes/context";
import { AgenteAvatar } from "@/components/shared/AgenteAvatar";
import { agruparPorPeriodo } from "@/app/pages/ceo/conversas-periodo";
import type { ConversaListItem } from "@/services/api/conversas";

// ----------------------------------------------------------------------

/** Filtro do histórico: "todas", "assistente", "agentes" ou o id de um agente. */
type Filtro = "todas" | "assistente" | "agentes" | (string & {});

interface Participante {
  id: string;
  titulo: string;
}

/**
 * Agentes que participaram da conversa, na ordem em que responderam. O nome
 * vem do que foi gravado na mensagem — vale para agentes personalizados,
 * inclusive os já excluídos.
 */
function agentesDaConversa(item: ConversaListItem): Participante[] {
  if (item.agentes?.length) return item.agentes;
  return (item.agenteIds ?? []).map((id) => ({ id, titulo: "" }));
}

function passaNoFiltro(item: ConversaListItem, filtro: Filtro): boolean {
  const agentes = agentesDaConversa(item);
  if (filtro === "todas") return true;
  if (filtro === "assistente") return agentes.length === 0;
  if (filtro === "agentes") return agentes.length > 0;
  return agentes.some((a) => a.id === filtro);
}

function hora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ----------------------------------------------------------------------

export function HistoricoTab() {
  const { t } = useTranslation();
  const { items, remove } = useConversasContext();
  const { porId } = useAgentes();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { abrirConversa, conversaId, loading, expandido, novaConversa } =
    useAssistente();

  // Confirmação inline: o `ConfirmModal` compartilhado vive em `z-100` e o
  // painel em `z-[110]`, então um diálogo abriria ATRÁS desta janela.
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const excluir = async (id: string) => {
    setErro(null);
    setExcluindo(id);
    try {
      await remove(id);
      setConfirmando(null);
      // A conversa aberta acabou de sumir: volta o painel para uma nova.
      if (id === conversaId) novaConversa();
    } catch {
      setErro(id);
    } finally {
      setExcluindo(null);
    }
  };

  // Agentes que aparecem no histórico — as opções individuais do filtro.
  const agentesNoHistorico = useMemo(() => {
    const porIdNoHistorico = new Map<string, OpcaoAgente>();
    for (const item of items) {
      for (const a of agentesDaConversa(item)) {
        if (porIdNoHistorico.has(a.id)) continue;
        const atual = porId(a.id);
        const titulo = a.titulo || atual?.titulo;
        if (!titulo) continue;
        porIdNoHistorico.set(a.id, {
          id: a.id,
          titulo,
          icone: atual?.icone ?? null,
        });
      }
    }
    return [...porIdNoHistorico.values()].sort((a, b) =>
      a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
  }, [items, porId]);

  // Filtro por um agente que saiu do histórico (conversa excluída) volta a "Todas".
  const filtroValido =
    filtro === "todas" ||
    filtro === "assistente" ||
    filtro === "agentes" ||
    agentesNoHistorico.some((a) => a.id === filtro)
      ? filtro
      : "todas";

  const filtrados = items.filter((i) => passaNoFiltro(i, filtroValido));
  const grupos = agruparPorPeriodo(filtrados);

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="dark:text-dark-300 text-center text-xs text-gray-500">
          {t("chrome.assistantHistoryEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        // Ampliado, as linhas ocupam a largura toda a 32px das bordas. O
        // `max-w-3xl` centralizado que havia aqui as deixava a ~116px num
        // modal de 1000px.
        expandido ? "p-8" : "px-3 py-3",
      )}
    >
      <FiltroHistorico
        valor={filtroValido}
        onChange={setFiltro}
        agentes={agentesNoHistorico}
      />
      {grupos.length === 0 && (
        <p className="dark:text-dark-300 px-1 py-6 text-center text-xs text-gray-500">
          Nenhuma conversa neste filtro.
        </p>
      )}
      {grupos.map((grupo) => (
        <div key={grupo.periodo} className="mb-3 last:mb-0">
          <p className="dark:text-dark-300 text-tiny px-1 font-medium tracking-wide text-gray-400 uppercase">
            {grupo.rotulo}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {grupo.items.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "group flex items-center rounded-lg transition-colors",
                  item.id === conversaId
                    ? "bg-primary-600/10 dark:bg-primary-400/10"
                    : "dark:hover:bg-dark-600/50 hover:bg-gray-100",
                )}
              >
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void abrirConversa(item.id)}
                  className="min-w-0 flex-1 px-2 py-1.5 text-left disabled:opacity-50"
                >
                  <p
                    className={clsx(
                      "text-xs-plus truncate font-medium",
                      item.id === conversaId
                        ? "text-primary-600 dark:text-primary-400"
                        : "dark:text-dark-100 text-gray-700",
                    )}
                  >
                    {item.title}
                  </p>
                  {erro === item.id ? (
                    <p className="text-error dark:text-error-light text-tiny truncate">
                      {t("chrome.assistantHistoryDeleteError")}
                    </p>
                  ) : (
                    <MetaConversa
                      agentes={agentesDaConversa(item)}
                      data={item.date}
                    />
                  )}
                </button>

                {confirmando === item.id ? (
                  <span className="flex shrink-0 items-center gap-0.5 pr-1">
                    <AcaoLinha
                      icon={CheckIcon}
                      label={t("chrome.assistantHistoryDeleteConfirm")}
                      disabled={excluindo === item.id}
                      onClick={() => void excluir(item.id)}
                      className="text-error hover:bg-error/10 dark:text-error-light"
                    />
                    <AcaoLinha
                      icon={XMarkIcon}
                      label={t("chrome.assistantHistoryDeleteCancel")}
                      disabled={excluindo === item.id}
                      onClick={() => {
                        setConfirmando(null);
                        setErro(null);
                      }}
                    />
                  </span>
                ) : (
                  <span className="shrink-0 pr-1">
                    <AcaoLinha
                      icon={TrashIcon}
                      label={t("chrome.assistantHistoryDelete")}
                      onClick={() => {
                        setErro(null);
                        setConfirmando(item.id);
                      }}
                      // Só some onde existe hover para revelá-lo de volta: o
                      // `group-hover` do Tailwind já nasce dentro de
                      // `@media (hover:hover)`, então esconder no toque
                      // (celular ou tablet) deixaria o ícone inalcançável.
                      className="focus-visible:opacity-100 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 [@media(hover:hover)]:sm:opacity-0"
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------

/**
 * Linha secundária: "<ícone> Cultura · 12:43" (ou "Assistente · 12:43"). O
 * agente é metadado — mesmo tamanho e cor da prévia que ocupava este lugar,
 * nunca mais forte que o título.
 */
function MetaConversa({
  agentes,
  data,
}: {
  agentes: Participante[];
  data: string;
}) {
  const { porId } = useAgentes();
  const nomes = agentes
    .map((a) => a.titulo || porId(a.id)?.titulo || "")
    .filter(Boolean);
  // Até dois participantes pelo nome; o resto vira "+N".
  const visiveis = nomes.slice(0, 2).join(" · ");
  const extras = nomes.length - 2;

  return (
    <p className="dark:text-dark-300 text-tiny flex min-w-0 items-center gap-1 text-gray-400">
      <span className="truncate">
        {nomes.length ? visiveis : "Assistente"}
        {extras > 0 && ` +${extras}`}
      </span>
      <span className="shrink-0">· {hora(data)}</span>
    </p>
  );
}

interface OpcaoAgente {
  id: string;
  titulo: string;
  icone: string | null;
}

const ITEM_FILTRO =
  "flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs-plus transition-colors";

function FiltroHistorico({
  valor,
  onChange,
  agentes,
}: {
  valor: Filtro;
  onChange: (f: Filtro) => void;
  agentes: OpcaoAgente[];
}) {
  const fixos: { id: Filtro; rotulo: string }[] = [
    { id: "todas", rotulo: "Todas" },
    { id: "assistente", rotulo: "Assistente" },
    { id: "agentes", rotulo: "Com agentes" },
  ];
  const rotulo =
    fixos.find((f) => f.id === valor)?.rotulo ??
    agentes.find((a) => a.id === valor)?.titulo ??
    "Todas";

  const item = (id: Filtro, texto: string, agente?: OpcaoAgente) => {
    return (
      <MenuItem key={id}>
        {({ focus }) => (
          <button
            type="button"
            onClick={() => onChange(id)}
            className={clsx(
              ITEM_FILTRO,
              focus
                ? "dark:bg-dark-600 dark:text-dark-50 bg-gray-100 text-gray-900"
                : "dark:text-dark-100 text-gray-700",
            )}
          >
            {agente && (
              <AgenteAvatar titulo={agente.titulo} icone={agente.icone} />
            )}
            <span className="min-w-0 flex-1 truncate">{texto}</span>
            {valor === id && (
              <CheckIcon className="text-primary-600 dark:text-primary-400 size-4 shrink-0" />
            )}
          </button>
        )}
      </MenuItem>
    );
  };

  return (
    <div className="mb-2 px-1">
      <Menu as="div" className="relative inline-block">
        <MenuButton className="dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
          {rotulo}
          <ChevronDownIcon className="size-3 opacity-70" />
        </MenuButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          {/* z-[120]: o menu ancorado vai para um portal, e o painel é z-[110]. */}
          <MenuItems
            anchor={{ to: "bottom start", gap: 4 }}
            className="dark:border-dark-500 dark:bg-dark-750 z-[120] max-h-80 w-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
          >
            {fixos.map((f) => item(f.id, f.rotulo))}
            {agentes.length > 0 && (
              <MenuSeparator className="dark:bg-dark-500 my-1 h-px bg-gray-200" />
            )}
            {agentes.map((a) => item(a.id, a.titulo, a))}
          </MenuItems>
        </Transition>
      </Menu>
    </div>
  );
}

/** Botão de ícone das ações da linha (excluir, confirmar, cancelar). */
function AcaoLinha({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={clsx(
        "dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-md text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 disabled:opacity-40",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
