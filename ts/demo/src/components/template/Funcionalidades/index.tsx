// Import Dependencies
import { ElementType, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  XMarkIcon,
  Squares2X2Icon,
  LinkIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  MapIcon,
  ShareIcon,
  BookOpenIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, ScrollShadow } from "@/components/ui";
import { useDisclosure } from "@/hooks";
import {
  getProductCodeFromPath,
  systemAreaPath,
} from "@/app/navigation/ceoOs";

// ----------------------------------------------------------------------

interface Feature {
  slug: string;
  label: string;
  Icon: ElementType;
  /** Classe de cor (texto) usada no ícone e no fundo suave do card. */
  tint: string;
}

// Funcionalidades disponíveis no menu "Funcionalidades" (ordem definida pelo
// produto). Os conectores migrados do beculture/Confi (CRM, WhatsApp) ficam no
// topo da lista para aparecerem agrupados no menu superior. Email e Slack saíram
// daqui: agora vivem no bloco "Painel" do menu esquerdo (ver ceoOs.behumanHome).
const FEATURES: Feature[] = [
  { slug: "crm", label: "CRM", Icon: ChartBarIcon, tint: "text-amber-500" },
  { slug: "whatsapp", label: "WhatsApp", Icon: ChatBubbleBottomCenterTextIcon, tint: "text-green-500" },
  { slug: "bloco-de-notas", label: "Bloco de Notas", Icon: PencilSquareIcon, tint: "text-amber-500" },
  { slug: "conectores", label: "Conectores", Icon: LinkIcon, tint: "text-indigo-500" },
  { slug: "documentos", label: "Documentos", Icon: DocumentTextIcon, tint: "text-orange-500" },
  { slug: "organograma", label: "Organograma", Icon: ShareIcon, tint: "text-indigo-500" },
  { slug: "memoria", label: "Regras", Icon: BookOpenIcon, tint: "text-rose-500" },
  { slug: "tour", label: "Tour", Icon: MapIcon, tint: "text-emerald-500" },
];

// v3: nenhum item vem fixado por padrão — o usuário fixa clicando no alfinete.
const STORAGE_KEY = "ceo-pinned-features-v3";
// Nenhum item fixado por padrão no menu superior.
const DEFAULT_PINNED: string[] = [];
// Nenhum item é fixado à força: todos podem ser fixados/desafixados pelo usuário.
const FORCED_PINNED: string[] = [];

function readPinned(): string[] {
  if (typeof window === "undefined") return DEFAULT_PINNED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PINNED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PINNED;
  } catch {
    return DEFAULT_PINNED;
  }
}

// Ícone de alfinete (thumbtack) — preenchido quando fixado.
function ThumbtackIcon({
  filled,
  ...props
}: { filled?: boolean } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
      <path d="M12 14v7" />
    </svg>
  );
}

// ----------------------------------------------------------------------

export function Funcionalidades() {
  const [isOpen, { open, close }] = useDisclosure();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const productCode = getProductCodeFromPath(pathname);

  const [pinned, setPinned] = useState<string[]>(readPinned);

  // Persiste a seleção de itens fixados.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
    } catch {
      /* ignora indisponibilidade de storage */
    }
  }, [pinned]);

  const togglePin = useCallback((slug: string) => {
    if (FORCED_PINNED.includes(slug)) return; // sempre fixo
    setPinned((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  // Itens forçados estão sempre fixados, mesmo com localStorage antigo.
  const effectivePinned = useMemo(
    () => Array.from(new Set([...pinned, ...FORCED_PINNED])),
    [pinned],
  );

  // Mantém a ordem definida em FEATURES para os itens fixados.
  const pinnedFeatures = FEATURES.filter((f) => effectivePinned.includes(f.slug));

  const goTo = (slug: string) => {
    navigate(systemAreaPath(productCode, slug));
    close();
  };

  return (
    <>
      {/* Itens fixados no menu superior */}
      {pinnedFeatures.map(({ slug, label, Icon }) => (
        <NavLink
          key={slug}
          to={systemAreaPath(productCode, slug)}
          title={label}
          aria-label={label}
          className={({ isActive }) =>
            clsx(
              "grid size-9 place-items-center rounded-full outline-hidden transition-colors",
              isActive
                ? "text-primary-600 dark:text-primary-400 bg-primary-600/10 dark:bg-primary-400/10"
                : "dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900",
            )
          }
        >
          <Icon className="size-5 stroke-[1.5]" />
        </NavLink>
      ))}

      {/* Gatilho do menu Funcionalidades */}
      <Button
        onClick={open}
        variant="flat"
        isIcon
        className="dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 relative size-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Funcionalidades"
        title="Funcionalidades"
      >
        <Squares2X2Icon className="size-5 stroke-[1.5]" />
      </Button>

      <FuncionalidadesPanel
        isOpen={isOpen}
        close={close}
        pinned={effectivePinned}
        togglePin={togglePin}
        onOpenFeature={goTo}
      />
    </>
  );
}

// ----------------------------------------------------------------------

interface PanelProps {
  isOpen: boolean;
  close: () => void;
  pinned: string[];
  togglePin: (slug: string) => void;
  onOpenFeature: (slug: string) => void;
}

function FuncionalidadesPanel({
  isOpen,
  close,
  pinned,
  togglePin,
  onOpenFeature,
}: PanelProps) {
  return (
    <Transition show={isOpen}>
      <Dialog open={true} onClose={close} static autoFocus>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="dark:bg-black/40 fixed inset-0 z-60 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        />

        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className="dark:bg-dark-750 fixed inset-y-0 right-0 z-61 flex w-screen transform-gpu flex-col bg-white transition-transform duration-200 sm:inset-y-2 sm:mx-2 sm:w-96 sm:rounded-xl"
        >
          {/* Cabeçalho */}
          <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
            <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
              Funcionalidades
            </DialogTitle>
            <Button
              onClick={close}
              variant="flat"
              isIcon
              className="size-8 rounded-full"
              aria-label="Fechar"
            >
              <XMarkIcon className="size-5" />
            </Button>
          </div>

          {/* Conteúdo */}
          <ScrollShadow
            size={4}
            className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-5"
          >
            <p className="dark:text-dark-300 pt-3 pb-4 text-xs-plus text-gray-400">
              Clique no ícone de alfinete para fixar no menu superior.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map(({ slug, label, Icon, tint }) => {
                const isPinned = pinned.includes(slug);
                const isForced = FORCED_PINNED.includes(slug);
                return (
                  <div
                    key={slug}
                    className="dark:border-dark-600 dark:hover:border-dark-400 relative flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300"
                  >
                    {/* Botão de fixar */}
                    <button
                      type="button"
                      onClick={() => togglePin(slug)}
                      disabled={isForced}
                      aria-pressed={isPinned}
                      aria-label={
                        isForced
                          ? `${label} fica sempre fixo no menu superior`
                          : isPinned
                            ? `Desafixar ${label} do menu superior`
                            : `Fixar ${label} no menu superior`
                      }
                      title={
                        isForced
                          ? "Sempre fixo no menu superior"
                          : isPinned
                            ? "Desafixar"
                            : "Fixar no menu superior"
                      }
                      className={clsx(
                        "absolute end-2 top-2 grid size-7 place-items-center rounded-lg outline-hidden transition-colors",
                        isForced
                          ? "text-primary-400/70 cursor-default dark:text-primary-400/60"
                          : isPinned
                            ? "text-primary-600 dark:text-primary-400"
                            : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-300 hover:text-gray-500",
                      )}
                    >
                      <ThumbtackIcon filled={isPinned} className="size-4" />
                    </button>

                    {/* Card clicável → abre a funcionalidade */}
                    <button
                      type="button"
                      onClick={() => onOpenFeature(slug)}
                      className="flex flex-col items-center gap-2 outline-hidden"
                    >
                      <span
                        className={clsx(
                          "grid size-12 place-items-center rounded-xl bg-current/10",
                          tint,
                        )}
                      >
                        <Icon className={clsx("size-6 stroke-[1.5]", tint)} />
                      </span>
                      <span className="dark:text-dark-100 text-center text-xs-plus font-medium text-gray-700">
                        {label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollShadow>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
