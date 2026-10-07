// Arquivo gerado por um agente, mostrado inline na conversa.
//
// O arquivo pertence à CONVERSA (vive no `meta` da mensagem): reabrir a conversa
// pelo Histórico o traz de volta. Ele NÃO entra no Repositório sozinho — só por
// "Salvar no Repositório", que usa o mesmo upload da tela Repositório (e as
// mesmas regras de quem pode enviar).
import { Fragment, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  CircleStackIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import clsx from "clsx";

import { Button, Spinner } from "@/components/ui";
import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import { useAssistente } from "@/app/contexts/assistente/context";
import {
  useDonoRepositorio,
  usePodeGerenciarRepositorio,
} from "@/app/pages/ceo/repositorio-org/useDocumentosOrg";
import { enviarDocumentoOrg } from "@/services/api/repositorioOrg";
import type { ArquivoConversa } from "@/services/api/prompt";
import { formatBytes } from "@/utils/arquivos";

// ----------------------------------------------------------------------

const ITEM_CLASS =
  "flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs-plus transition-colors disabled:opacity-50";

function baixar(arquivo: ArquivoConversa) {
  const blob = new Blob([arquivo.conteudo], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ArquivoCard({
  arquivo,
  mensagemId,
  geradoPor,
}: {
  arquivo: ArquivoConversa;
  mensagemId?: string;
  /** Nome do agente que gerou o arquivo (o arquivo é da conversa). */
  geradoPor?: string;
}) {
  const { marcarArquivoSalvo } = useAssistente();
  const dono = useDonoRepositorio();
  const podeSalvar = usePodeGerenciarRepositorio() && !!dono;
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const salvo = !!arquivo.repositorioDocumentoId;

  const salvarNoRepositorio = async () => {
    if (!dono || salvo || salvando) return;
    setSalvando(true);
    try {
      const documento = await enviarDocumentoOrg(
        dono,
        new File([arquivo.conteudo], arquivo.nome, { type: "text/markdown" }),
      );
      if (mensagemId) {
        await marcarArquivoSalvo({
          mensagemId,
          arquivoId: arquivo.id,
          repositorioDocumentoId: documento.id,
        });
      }
      toast.success(`“${arquivo.nome}” salvo no Repositório.`);
    } catch {
      toast.error("Não foi possível salvar no Repositório.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="dark:border-dark-500 dark:bg-dark-700 mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="dark:bg-dark-600 dark:text-dark-200 grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
          <DocumentTextIcon className="size-5 stroke-[1.5]" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="dark:text-dark-100 truncate text-sm font-medium text-gray-800"
            title={arquivo.nome}
          >
            {arquivo.nome}
          </p>
          <p className="dark:text-dark-300 text-tiny mt-0.5 flex items-center gap-1.5 text-gray-400">
            <span>MD · {formatBytes(arquivo.tamanho)}</span>
            {geradoPor && (
              <span className="min-w-0 truncate">· Gerado por {geradoPor}</span>
            )}
            {salvo && (
              <span className="text-success dark:text-success-lighter inline-flex items-center gap-0.5">
                <CheckCircleIcon className="size-3.5" />
                Salvo no Repositório
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="outlined"
          onClick={() => setAberto(true)}
          className="h-8 rounded-lg px-3 text-xs"
        >
          Visualizar
        </Button>

        <Menu as="div" className="relative">
          <MenuButton
            aria-label={`Ações de ${arquivo.nome}`}
            className="dark:text-dark-300 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
          >
            {salvando ? (
              <Spinner className="size-4" />
            ) : (
              <EllipsisHorizontalIcon className="size-5" />
            )}
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
            <MenuItems
              anchor={{ to: "bottom end", gap: 4 }}
              className="dark:border-dark-500 dark:bg-dark-750 z-[120] w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
            >
              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => baixar(arquivo)}
                    className={clsx(
                      ITEM_CLASS,
                      focus
                        ? "dark:bg-dark-600 dark:text-dark-50 bg-gray-100 text-gray-900"
                        : "dark:text-dark-100 text-gray-700",
                    )}
                  >
                    <ArrowDownTrayIcon className="size-4 shrink-0" />
                    Baixar
                  </button>
                )}
              </MenuItem>
              {podeSalvar && (
                <MenuItem disabled={salvo || salvando}>
                  {({ focus, disabled }) => (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void salvarNoRepositorio()}
                      className={clsx(
                        ITEM_CLASS,
                        focus
                          ? "dark:bg-dark-600 dark:text-dark-50 bg-gray-100 text-gray-900"
                          : "dark:text-dark-100 text-gray-700",
                      )}
                    >
                      {salvo ? (
                        <CheckCircleIcon className="size-4 shrink-0" />
                      ) : (
                        <CircleStackIcon className="size-4 shrink-0" />
                      )}
                      {salvo ? "Salvo no Repositório" : "Salvar no Repositório"}
                    </button>
                  )}
                </MenuItem>
              )}
            </MenuItems>
          </Transition>
        </Menu>
      </div>

      <Transition show={aberto} appear>
        {/* z-[130]: acima do painel do assistente (z-[110]) e dos menus dele. */}
        <Dialog
          open={aberto}
          onClose={() => setAberto(false)}
          className="relative z-[130]"
        >
          <TransitionChild
            as="div"
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 grid place-items-center p-4">
            <TransitionChild
              as={DialogPanel}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
              // ESC fecha só o visualizador. Sem isto ele chegaria também ao
              // atalho de ESC do painel (react-hotkeys-hook, no document) e
              // fecharia o Assistente junto.
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setAberto(false);
              }}
              className="dark:bg-dark-800 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
            >
              <div className="dark:border-dark-600 flex items-center gap-3 border-b border-gray-200 px-5 py-3">
                <DocumentTextIcon className="dark:text-dark-200 size-5 shrink-0 text-gray-500" />
                <DialogTitle
                  as="h3"
                  className="dark:text-dark-50 min-w-0 flex-1 truncate text-sm font-semibold text-gray-800"
                >
                  {arquivo.nome}
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => baixar(arquivo)}
                  aria-label="Baixar"
                  title="Baixar"
                  className="dark:text-dark-300 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <ArrowDownTrayIcon className="size-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="dark:text-dark-300 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <MarkdownView>{arquivo.conteudo}</MarkdownView>
              </div>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
