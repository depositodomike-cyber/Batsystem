// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  QuestionMarkCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { ElementType, Fragment, ReactNode } from "react";

// Local Imports
import { Button } from "@/components/ui";
import { useDisclosure } from "@/hooks";

// ----------------------------------------------------------------------
// Título de página com um botão de ajuda ("?") ao lado. Ao clicar, abre um
// modal explicando o que é a página. O modal aceita, opcionalmente, um vídeo
// (YouTube, Vimeo ou arquivo direto .mp4/.webm/.ogg).
//
// Uso (substitui o <h2> inline padrão das páginas):
//   <PageTitle
//     help={{
//       description: <p>Explicação da página…</p>,
//       videoUrl: "https://youtu.be/xxxx", // opcional
//     }}
//   >
//     Insights
//   </PageTitle>
// ----------------------------------------------------------------------

/** Classe padrão de título de página usada no app (igual aos <h2> inline). */
export const PAGE_TITLE_CLASS =
  "dark:text-dark-50 text-2xl font-semibold tracking-wide text-gray-800";

export interface PageHelp {
  /** Cabeçalho do modal. Se omitido, usa o próprio título da página. */
  title?: ReactNode;
  /** Conteúdo explicativo (texto/JSX) exibido no modal. */
  description: ReactNode;
  /** URL de vídeo opcional (YouTube, Vimeo ou arquivo .mp4/.webm/.ogg). */
  videoUrl?: string;
}

interface PageTitleProps {
  /** O texto do título da página. */
  children: ReactNode;
  /** Conteúdo de ajuda. Se omitido, o botão "?" não é renderizado. */
  help?: PageHelp;
  /** Tag do título. Padrão: "h2". */
  as?: ElementType;
  /** Classe do título. Padrão: estilo canônico de título de página. */
  className?: string;
  /** Classe do wrapper (linha do título + botão). */
  wrapperClassName?: string;
  /** Rótulo acessível do botão de ajuda. */
  helpLabel?: string;
}

export function PageTitle({
  children,
  help,
  as,
  className,
  wrapperClassName,
  helpLabel = "Sobre esta página",
}: PageTitleProps) {
  const Heading: ElementType = as || "h2";
  const [isOpen, { open, close }] = useDisclosure(false);

  return (
    <>
      <div className={clsx("flex items-center gap-2", wrapperClassName)}>
        <Heading className={className ?? PAGE_TITLE_CLASS}>{children}</Heading>

        {help && (
          <Button
            type="button"
            onClick={open}
            variant="flat"
            isIcon
            aria-label={helpLabel}
            title={helpLabel}
            className="pointer-events-auto size-6 shrink-0 rounded-lg text-gray-400 hover:text-primary-600 dark:text-dark-300 dark:hover:text-primary-400"
          >
            <QuestionMarkCircleIcon className="size-5" />
          </Button>
        )}
      </div>

      {help && (
        <HelpModal
          isOpen={isOpen}
          onClose={close}
          title={help.title ?? children}
          description={help.description}
          videoUrl={help.videoUrl}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  videoUrl?: string;
}

function HelpModal({
  isOpen,
  onClose,
  title,
  description,
  videoUrl,
}: HelpModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
        onClose={onClose}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="absolute inset-0 bg-gray-900/50 transition-opacity dark:bg-black/40" />
        </TransitionChild>

        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <DialogPanel className="scrollbar-sm relative flex w-full max-w-lg flex-col overflow-y-auto rounded-lg bg-white transition-opacity duration-300 dark:bg-dark-700">
            <div className="flex items-center justify-between px-4 py-3 sm:px-5">
              <DialogTitle
                as="h3"
                className="dark:text-dark-100 text-base font-medium text-gray-800"
              >
                {title}
              </DialogTitle>
              <Button
                onClick={onClose}
                variant="flat"
                isIcon
                aria-label="Fechar"
                className="size-7 rounded-lg ltr:-mr-1.5 rtl:-ml-1.5"
              >
                <XMarkIcon className="size-4.5" />
              </Button>
            </div>

            <div className="dark:border-dark-600 border-t border-gray-200" />

            <div className="px-4 py-4 sm:px-5">
              {videoUrl && (
                <div className="dark:bg-dark-900 mb-4 overflow-hidden rounded-lg bg-black">
                  <HelpVideo url={videoUrl} />
                </div>
              )}

              <div className="dark:text-dark-200 text-sm text-gray-600 [&_a]:text-primary-600 [&_a]:dark:text-primary-400 [&_p+p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                {description}
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------
// Renderiza o vídeo de ajuda a partir da URL: arquivos diretos usam <video>;
// YouTube/Vimeo (ou qualquer outra URL) usam <iframe> num container 16:9.

function HelpVideo({ url }: { url: string }) {
  const embedUrl = toEmbedUrl(url);

  if (isDirectVideoFile(url)) {
    return (
      <video controls className="aspect-video w-full" src={url}>
        Seu navegador não suporta a reprodução de vídeo.
      </video>
    );
  }

  return (
    <iframe
      src={embedUrl}
      title="Vídeo de ajuda"
      className="aspect-video w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/** Converte URLs de YouTube/Vimeo em URL de embed. Demais URLs seguem como estão. */
function toEmbedUrl(url: string): string {
  // YouTube: youtu.be/ID  |  youtube.com/watch?v=ID  |  youtube.com/embed/ID
  const yt =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

  // Vimeo: vimeo.com/ID  |  player.vimeo.com/video/ID
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;

  return url;
}
