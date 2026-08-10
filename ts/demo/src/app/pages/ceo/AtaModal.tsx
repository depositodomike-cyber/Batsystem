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
  ClipboardDocumentListIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea, MemoriaInput } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { MarkdownView } from "./MarkdownView";
import { gerarAtaApi } from "@/services/api/ata";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { nomesDeParticipantes } from "@/utils/memoriaVault";

// ----------------------------------------------------------------------
// Criar Ata — portado do beculture/Confi. Sobe um arquivo (ou cola a
// transcrição) → a IA redige uma ata executiva editável. Opção "Memória"
// formata com frontmatter + [[wikilinks]] às regras existentes.
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao criar a ata. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function AtaModal({ isOpen, close, onMinimize }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [memoria, setMemoria] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [titulo, setTitulo] = useState("");
  const [ata, setAta] = useState<string | null>(null);
  const [aba, setAba] = useState<"previa" | "editar">("previa");

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  const fechar = () => {
    if (loading) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!arquivo && !texto.trim()) return setErro("Envie um arquivo ou cole o conteúdo da reunião.");
    setLoading(true);
    try {
      const data = await gerarAtaApi({
        arquivo,
        texto: texto.trim() || undefined,
        instrucoes: instrucoes.trim() || undefined,
        memoria,
        design,
      });
      setTitulo(data.titulo);
      setAta(data.ata);
      setAba("previa");
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const nova = () => {
    setAta(null);
    setTitulo("");
    setErro("");
  };

  const docCompleto = () => `# ${titulo}\n\n${ata ?? ""}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(docCompleto());
      toast("Copiado", { description: "Ata copiada para a área de transferência." });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixar = () => {
    const blob = new Blob([docCompleto()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "ata"}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
              {/* Cabeçalho */}
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <ClipboardDocumentListIcon className="size-5" />
                  IA · Criar ata
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={loading}
                />
              </div>

              <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
                {/* Resultado */}
                {ata !== null ? (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <input
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-50 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-base font-semibold placeholder:text-gray-400"
                        placeholder="Título da ata"
                      />
                      <Button onClick={nova} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                        <ArrowPathIcon className="size-4" /> Nova
                      </Button>
                      <Button onClick={copiar} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                        <ClipboardDocumentIcon className="size-4" /> Copiar
                      </Button>
                      <Button onClick={baixar} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                        <ArrowDownTrayIcon className="size-4" /> .md
                      </Button>
                      <SalvarNaMemoriaButton
                        pasta={PASTA_MEMORIA.ata}
                        titulo={titulo}
                        conteudo={ata}
                        tags={["ata", "reunião"]}
                        pessoas={nomesDeParticipantes(ata ?? "")}
                      />
                      <EnviarParaGrupoButton
                        funcao="ata"
                        titulo={titulo}
                        conteudo={ata}
                      />
                    </div>

                    {/* Abas Prévia / Editar */}
                    <div className="dark:border-dark-600 mb-3 flex gap-1 border-b border-gray-200">
                      {(["previa", "editar"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setAba(k)}
                          className={clsx(
                            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs-plus font-medium transition-colors",
                            aba === k
                              ? "border-primary-500 text-primary-600 dark:text-primary-400"
                              : "dark:text-dark-300 border-transparent text-gray-500 hover:text-gray-700",
                          )}
                        >
                          {k === "previa" ? <EyeIcon className="size-4" /> : <PencilSquareIcon className="size-4" />}
                          {k === "previa" ? "Prévia" : "Editar"}
                        </button>
                      ))}
                    </div>

                    {aba === "previa" ? (
                      <MarkdownView>{ata}</MarkdownView>
                    ) : (
                      <MemoriaTextarea
                        value={ata}
                        onChange={(e) => setAta(e.target.value)}
                        rows={18}
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs-plus leading-relaxed"
                      />
                    )}
                  </div>
                ) : loading ? (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">A IA está redigindo a ata…</p>
                    </div>
                  </div>
                ) : (
                  /* Formulário */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      gerar();
                    }}
                    className="flex flex-col gap-3"
                  >
                    <DesignSystemBar />

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Arquivo da reunião <span className="text-gray-400">(.txt, .md, .pdf, .docx…)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="dark:border-dark-500 dark:hover:border-dark-400 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs-plus text-gray-600 hover:border-gray-400 dark:text-dark-200">
                          <ArrowUpTrayIcon className="size-4" />
                          Carregar arquivo
                          <input type="file" accept={ACCEPT} hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
                        </label>
                        <span className="dark:text-dark-300 min-w-0 truncate text-xs text-gray-500">{arquivo?.name ?? ""}</span>
                      </div>
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Ou cole o conteúdo <span className="text-gray-400">(transcrição / anotações)</span>
                      </label>
                      <MemoriaTextarea
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        rows={5}
                        placeholder="Cole aqui a transcrição ou as anotações da reunião…"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Instruções <span className="text-gray-400">(opcional)</span>
                      </label>
                      <MemoriaInput
                        value={instrucoes}
                        onChange={(e) => setInstrucoes(e.target.value)}
                        placeholder="Ex.: foco nas decisões, tom mais formal, destacar prazos…"
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                      <Checkbox checked={memoria} onChange={(e) => setMemoria(e.target.checked)} className="size-4" />
                      Formatar para o Repositório <span className="text-gray-400">(frontmatter + [[relacionamentos]])</span>
                    </label>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button type="submit" color="primary" disabled={!arquivo && !texto.trim()} className="gap-2">
                        <ClipboardDocumentListIcon className="size-5" />
                        Criar ata
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
  );
}
