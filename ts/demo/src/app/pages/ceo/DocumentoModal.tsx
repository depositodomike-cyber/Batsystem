// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { useDocumentoUpload } from "@/app/contexts/documento-upload/context";

// ----------------------------------------------------------------------
// Upload Documento — ponto de entrada. O usuário cola texto ou escolhe um
// arquivo; ao enviar, o DocumentoUploadProvider assume a requisição e
// navega para a página do documento, onde o processamento continua.
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function DocumentoModal({ isOpen, close, onMinimize }: Props) {
  const { iniciar } = useDocumentoUpload();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  const fechar = () => {
    close();
  };

  const enviar = () => {
    setErro("");
    if (!arquivo && !texto.trim()) {
      setErro("Cole o conteúdo ou envie um arquivo.");
      return;
    }
    iniciar({ arquivo, texto: texto.trim() || undefined });
    // Limpa o formulário para a próxima abertura e fecha o modal.
    setArquivo(null);
    setTexto("");
    setErro("");
    close();
  };

  return (
    <Transition show={isOpen}>
      <Dialog onClose={fechar} className="relative z-[70]">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <DocumentTextIcon className="size-5" />
                  IA · Upload Documento
                </DialogTitle>
                <WindowControls onMinimize={onMinimize} onClose={fechar} />
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviar();
                  }}
                  className="flex flex-col gap-3"
                >
                  <p className="dark:border-primary-500/20 dark:bg-primary-500/10 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs-plus text-gray-600 dark:text-dark-200">
                    A IA formata o conteúdo num <b>documento de referência</b> bem
                    estruturado e o <b>salva no Contexto</b> (Documentos), com{" "}
                    <span className="font-mono">[[relacionamentos]]</span> às
                    regras existentes.
                  </p>

                  <div>
                    <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                      Cole o conteúdo do documento
                    </label>
                    <MemoriaTextarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={6}
                      placeholder="Cole aqui o texto do documento…"
                      className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                      — ou — envie um arquivo{" "}
                      <span className="text-gray-400">
                        (.txt, .md, .pdf, .docx…)
                      </span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="dark:border-dark-500 dark:hover:border-dark-400 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs-plus text-gray-600 hover:border-gray-400 dark:text-dark-200">
                        <ArrowUpTrayIcon className="size-4" /> Carregar arquivo
                        <input
                          type="file"
                          accept={ACCEPT}
                          hidden
                          onChange={(e) =>
                            setArquivo(e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                      <span className="dark:text-dark-300 min-w-0 truncate text-xs text-gray-500">
                        {arquivo?.name ?? ""}
                      </span>
                    </div>
                  </div>

                  {erro && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                      {erro}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      color="primary"
                      disabled={!arquivo && !texto.trim()}
                      className="gap-2"
                    >
                      <DocumentTextIcon className="size-5" /> Organizar e salvar
                    </Button>
                  </div>
                </form>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
