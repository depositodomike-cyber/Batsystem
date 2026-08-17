// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  DocumentTextIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button } from "@/components/ui";
import type { Chat } from "@/app/contexts/chats/context";
import type {
  DocumentAttachment,
  SquadDocument,
} from "@/app/contexts/documents/context";
import { MarkdownView } from "./MarkdownView";

// ----------------------------------------------------------------------

export type SidePanelTab = "history" | "documents";

interface SidePanelProps {
  activeTab: SidePanelTab;
  onTabChange: (t: SidePanelTab) => void;
  chats: Chat[];
  documents: SquadDocument[];
  onOpenChat: (c: Chat) => void;
  onOpenDocument: (d: SquadDocument) => void;
  /** Texto exibido quando não há conversas. */
  emptyChatsText?: string;
  /** Texto exibido quando não há documentos. */
  emptyDocsText?: string;
  /**
   * Renderização customizada de cada conversa (ex.: item com menu de ações).
   * Quando ausente, usa o item padrão clicável que dispara `onOpenChat`.
   */
  renderChatItem?: (chat: Chat) => React.ReactNode;
}

/**
 * Painel lateral fixo (direita) com abas de Histórico (conversas) e Documentos.
 * Compartilhado entre as páginas de Squad e de Grupo.
 */
export function SidePanel({
  activeTab,
  onTabChange,
  chats,
  documents,
  onOpenChat,
  onOpenDocument,
  emptyChatsText = "As conversas aparecem aqui.",
  emptyDocsText = "Salve respostas como documento usando o botão na bolha do agente.",
  renderChatItem,
}: SidePanelProps) {
  return (
    <aside className="dark:border-dark-500 dark:bg-dark-750 flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50/50">
      {/* Abas */}
      <div className="dark:border-dark-500 flex border-b border-gray-200">
        <TabButton
          active={activeTab === "history"}
          onClick={() => onTabChange("history")}
          icon={<ClockIcon className="size-4 stroke-[1.75]" />}
          label="Histórico"
          count={chats.length}
        />
        <TabButton
          active={activeTab === "documents"}
          onClick={() => onTabChange("documents")}
          icon={<DocumentTextIcon className="size-4 stroke-[1.75]" />}
          label="Documentos"
          count={documents.length}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === "history" ? (
          chats.length === 0 ? (
            <EmptyHint
              icon={<ClockIcon className="size-5" />}
              text={emptyChatsText}
            />
          ) : renderChatItem ? (
            <div className="flex flex-col space-y-0.5">
              {chats.map((c) => (
                <div key={c.id}>{renderChatItem(c)}</div>
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenChat(c)}
                    className="dark:hover:bg-dark-600 dark:text-dark-100 group flex w-full flex-col rounded-md px-2 py-1.5 text-start hover:bg-white"
                  >
                    <span className="dark:text-dark-50 line-clamp-2 text-xs font-medium text-gray-800">
                      {c.title}
                    </span>
                    {(c.agentReference ?? c.squadName) && (
                      <span className="dark:text-dark-300 mt-0.5 text-tiny-plus text-gray-500">
                        {c.agentReference ?? c.squadName}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : documents.length === 0 ? (
          <EmptyHint
            icon={<DocumentTextIcon className="size-5" />}
            text={emptyDocsText}
          />
        ) : (
          <ul className="space-y-1">
            {documents.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpenDocument(d)}
                  className="dark:hover:bg-dark-600 dark:text-dark-100 group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start hover:bg-white"
                >
                  <DocumentTextIcon className="text-primary-500 mt-0.5 size-4 shrink-0 stroke-[1.75]" />
                  <div className="min-w-0 flex-1">
                    <span className="dark:text-dark-50 line-clamp-2 text-xs font-medium text-gray-800">
                      {d.title}
                    </span>
                    <span className="dark:text-dark-300 mt-0.5 block text-tiny-plus text-gray-500">
                      {d.agentReference ?? d.squadName}
                      {" · "}
                      {new Date(d.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary-500 text-primary-600 dark:text-primary-400"
          : "dark:text-dark-300 dark:hover:text-dark-100 border-transparent text-gray-500 hover:text-gray-800",
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={clsx(
            "rounded-lg px-1.5 text-tiny-plus",
            active
              ? "bg-primary-500/10 text-primary-700 dark:text-primary-300"
              : "dark:bg-dark-500 dark:text-dark-200 bg-gray-200 text-gray-600",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="dark:text-dark-300 flex flex-col items-center px-4 py-8 text-center text-gray-400">
      <span className="dark:text-dark-400 mb-2">{icon}</span>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}

// ----------------------------------------------------------------------

export function DocumentPreviewModal({
  document: doc,
  close,
}: {
  document: SquadDocument | null;
  close: () => void;
}) {
  return (
    <Transition
      appear
      show={doc !== null}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={close}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity dark:bg-black/50"
      />
      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
        className="dark:bg-dark-700 relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl transition-all"
      >
        {doc && (
          <>
            <div className="flex items-start gap-3 border-b border-gray-200 px-6 py-5 dark:border-dark-500">
              <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 grid size-10 shrink-0 place-items-center rounded-lg">
                <DocumentTextIcon className="size-5 stroke-[1.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
                  Documento · {doc.squadName}
                  {doc.agentReference ? ` · ${doc.agentReference}` : ""}
                </p>
                <DialogTitle
                  as="h2"
                  className="dark:text-dark-50 text-lg font-semibold text-gray-800"
                >
                  {doc.title}
                </DialogTitle>
                <p className="dark:text-dark-400 mt-0.5 text-xs text-gray-400">
                  {new Date(doc.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={close}
                aria-label="Fechar"
                className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {doc.source === "ai-studio" ? (
                <MarkdownView>{doc.content}</MarkdownView>
              ) : (
                <pre className="dark:text-dark-100 whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                  {doc.content}
                </pre>
              )}

              {doc.attachments?.length ? (
                <div className="dark:border-dark-600 mt-4 space-y-3 border-t border-gray-100 pt-4">
                  {doc.attachments.map((a) => (
                    <AttachmentView key={a.name} attachment={a} />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4 dark:border-dark-500">
              <Button variant="flat" onClick={close}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </TransitionChild>
    </Transition>
  );
}

// ----------------------------------------------------------------------

/**
 * Anexo do documento. Imagem e vídeo aparecem embutidos; HTML (carrossel,
 * painel) abre em aba própria; o resto vira download. O data-URI é convertido
 * em blob na hora de abrir/baixar — abrir um data-URI de HTML direto é
 * bloqueado pelos navegadores.
 */
function AttachmentView({ attachment: a }: { attachment: DocumentAttachment }) {
  const abrir = () => {
    const url = URL.createObjectURL(dataUrlToBlob(a.dataUrl, a.mime));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const baixar = () => {
    const url = URL.createObjectURL(dataUrlToBlob(a.dataUrl, a.mime));
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (a.mime.startsWith("image/")) {
    return (
      <figure>
        <img
          src={a.dataUrl}
          alt={a.name}
          className="dark:border-dark-600 w-full rounded-lg border border-gray-200"
        />
        <figcaption className="dark:text-dark-400 mt-1 flex items-center justify-between text-tiny-plus text-gray-400">
          <span className="truncate">{a.name}</span>
          <AttachmentAction icon={ArrowDownTrayIcon} label="Baixar" onClick={baixar} />
        </figcaption>
      </figure>
    );
  }

  if (a.mime.startsWith("video/")) {
    return (
      <figure>
        <video
          src={a.dataUrl}
          controls
          className="dark:border-dark-600 w-full rounded-lg border border-gray-200"
        />
        <figcaption className="dark:text-dark-400 mt-1 flex items-center justify-between text-tiny-plus text-gray-400">
          <span className="truncate">{a.name}</span>
          <AttachmentAction icon={ArrowDownTrayIcon} label="Baixar" onClick={baixar} />
        </figcaption>
      </figure>
    );
  }

  const abrivel = a.mime === "text/html";

  return (
    <div className="dark:border-dark-600 dark:bg-dark-800/40 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <PaperClipIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-xs text-gray-700">
        {a.name}
      </span>
      {abrivel && (
        <AttachmentAction
          icon={ArrowTopRightOnSquareIcon}
          label="Abrir"
          onClick={abrir}
        />
      )}
      <AttachmentAction icon={ArrowDownTrayIcon} label="Baixar" onClick={baixar} />
    </div>
  );
}

function AttachmentAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-primary-600 dark:text-primary-400 flex shrink-0 items-center gap-1 text-tiny-plus hover:underline"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function dataUrlToBlob(dataUrl: string, mime: string): Blob {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
