// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { MarkdownView } from "./MarkdownView";
import { SugerirPosUploadModal } from "./SugerirPosUpload";
import { gerarDocumentoApi } from "@/services/api/documento";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Upload Documento — portado do beculture/Confi. Cola/sobe um documento → a IA
// organiza num documento de referência bem estruturado e o SALVA na Memória
// (Documentos).
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao organizar o documento. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function DocumentoModal({ isOpen, close, onMinimize }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  // Pergunta pós-upload: só abre quando o documento foi de fato salvo na Memória.
  const [sugerirOpen, setSugerirOpen] = useState(false);

  const fechar = () => {
    if (loading) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!arquivo && !texto.trim()) return setErro("Cole o conteúdo ou envie um arquivo.");
    setLoading(true);
    try {
      const data = await gerarDocumentoApi({ arquivo, texto: texto.trim() || undefined });
      setTitulo(data.titulo);
      setConteudo(data.conteudo);
      setSalvo(data.salvo);
      toast(data.salvo ? "Documento salvo na Memória" : "Documento gerado", {
        description: data.salvo ? "Guardado em Documentos." : "Não foi possível salvar na Memória.",
      });
      if (data.salvo) setSugerirOpen(true);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const novo = () => {
    setConteudo(null);
    setTitulo("");
    setErro("");
  };

  const docCompleto = () => `# ${titulo}\n\n${conteudo ?? ""}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(docCompleto());
      toast("Copiado");
    } catch {
      toast("Não foi possível copiar");
    }
  };
  const baixar = () => {
    const blob = new Blob([docCompleto()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "documento"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
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
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={loading}
                />
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                {conteudo !== null ? (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">{titulo}</h3>
                        {salvo && (
                          <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircleIcon className="size-4" /> Salvo na Memória · Documentos
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={novo} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          <ArrowPathIcon className="size-4" /> Novo
                        </Button>
                        <Button onClick={copiar} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          <ClipboardDocumentIcon className="size-4" /> Copiar
                        </Button>
                        <Button onClick={baixar} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          <ArrowDownTrayIcon className="size-4" /> .md
                        </Button>
                        <SalvarNaMemoriaButton
                          pasta={PASTA_MEMORIA.documento}
                          titulo={titulo}
                          conteudo={conteudo}
                          tags={["documento"]}
                        />
                        <EnviarParaGrupoButton
                          funcao="documento"
                          titulo={titulo}
                          conteudo={conteudo}
                        />
                      </div>
                    </div>
                    <div className="dark:border-dark-600 border-t border-gray-100 pt-3">
                      <MarkdownView>{conteudo}</MarkdownView>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">A IA está organizando o documento…</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); gerar(); }} className="flex flex-col gap-3">
                    <p className="dark:border-primary-500/20 dark:bg-primary-500/10 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs-plus text-gray-600 dark:text-dark-200">
                      A IA formata o conteúdo num <b>documento de referência</b> bem estruturado e o <b>salva na Memória</b> (Documentos), com <span className="font-mono">[[relacionamentos]]</span> às diretrizes existentes.
                    </p>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Cole o conteúdo do documento</label>
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
                        — ou — envie um arquivo <span className="text-gray-400">(.txt, .md, .pdf, .docx…)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="dark:border-dark-500 dark:hover:border-dark-400 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs-plus text-gray-600 hover:border-gray-400 dark:text-dark-200">
                          <ArrowUpTrayIcon className="size-4" /> Carregar arquivo
                          <input type="file" accept={ACCEPT} hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                        </label>
                        <span className="dark:text-dark-300 min-w-0 truncate text-xs text-gray-500">{arquivo?.name ?? ""}</span>
                      </div>
                    </div>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button type="submit" color="primary" disabled={!arquivo && !texto.trim()} className="gap-2">
                        <DocumentTextIcon className="size-5" /> Organizar e salvar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>

    {/* Pergunta pós-upload: gerar atividades ou insights sobre o documento. */}
    <SugerirPosUploadModal
      isOpen={sugerirOpen}
      close={() => setSugerirOpen(false)}
      titulo={titulo}
      conteudo={conteudo ?? undefined}
    />
    </>
  );
}
