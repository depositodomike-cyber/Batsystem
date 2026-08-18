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
  DocumentCheckIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import {
  MemoriaTextarea,
  MemoriaInput,
} from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { MarkdownView } from "./MarkdownView";
import { SugerirPosUploadModal } from "./SugerirPosUpload";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { nomesDeParticipantes } from "@/utils/memoriaVault";
import { gerarTranscricaoApi } from "@/services/api/transcricao";

// ----------------------------------------------------------------------
// Upload Transcrição — portado do beculture/Confi. Cola/sobe uma transcrição →
// a IA gera uma ATA estratégica detalhada e a SALVA no Repositório (Reuniões).
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar a ata. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function TranscricaoModal({ isOpen, close, onMinimize }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [ata, setAta] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  // Pergunta pós-upload: só abre quando a ata foi de fato salva no Repositório.
  const [sugerirOpen, setSugerirOpen] = useState(false);

  const fechar = () => {
    if (loading) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!arquivo && !texto.trim())
      return setErro("Cole a transcrição ou envie um arquivo.");
    setLoading(true);
    try {
      const data = await gerarTranscricaoApi({
        arquivo,
        texto: texto.trim() || undefined,
        instrucoes: instrucoes.trim() || undefined,
      });
      setTitulo(data.titulo);
      setAta(data.ata);
      setSalvo(data.salvo);
      toast(data.salvo ? "Ata salva no Repositório" : "Ata gerada", {
        description: data.salvo
          ? "Guardada em Reuniões."
          : "Não foi possível salvar no Repositório.",
      });
      if (data.salvo) setSugerirOpen(true);
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
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "ata"}.md`;
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
                    <DocumentCheckIcon className="size-5" />
                    IA · Upload Transcrição
                  </DialogTitle>
                  <WindowControls
                    onMinimize={onMinimize}
                    onClose={fechar}
                    closeDisabled={loading}
                  />
                </div>

                <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                  {ata !== null ? (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                            {titulo}
                          </h3>
                          {salvo && (
                            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircleIcon className="size-4" /> Salva no
                              Repositório · Reuniões
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={nova}
                            variant="outlined"
                            className="text-xs-plus h-8 gap-1.5 px-2.5"
                          >
                            <ArrowPathIcon className="size-4" /> Nova
                          </Button>
                          <Button
                            onClick={copiar}
                            variant="outlined"
                            className="text-xs-plus h-8 gap-1.5 px-2.5"
                          >
                            <ClipboardDocumentIcon className="size-4" /> Copiar
                          </Button>
                          <Button
                            onClick={baixar}
                            variant="outlined"
                            className="text-xs-plus h-8 gap-1.5 px-2.5"
                          >
                            <ArrowDownTrayIcon className="size-4" /> .md
                          </Button>
                          <SalvarNaMemoriaButton
                            pasta={PASTA_MEMORIA.reunioes}
                            titulo={titulo}
                            conteudo={ata}
                            tags={["reunião", "ata"]}
                            pessoas={nomesDeParticipantes(ata)}
                          />
                          <EnviarParaGrupoButton
                            funcao="transcricao"
                            titulo={titulo}
                            conteudo={ata}
                          />
                        </div>
                      </div>
                      <div className="dark:border-dark-600 border-t border-gray-100 pt-3">
                        <MarkdownView>{ata}</MarkdownView>
                      </div>
                    </div>
                  ) : loading ? (
                    <div className="grid place-items-center py-10">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <Spinner className="size-6" />
                        <p className="dark:text-dark-200 text-sm text-gray-600">
                          Formatando e gerando a ATA estratégica…
                        </p>
                        <p className="dark:text-dark-300 text-xs text-gray-400">
                          Transcrições longas podem levar ~1 minuto.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        gerar();
                      }}
                      className="flex flex-col gap-3"
                    >
                      <p className="dark:border-primary-500/20 dark:bg-primary-500/10 border-primary-200 bg-primary-50 text-xs-plus dark:text-dark-200 rounded-lg border px-3 py-2 text-gray-600">
                        Gera uma <b>ATA estratégica e detalhada</b> a partir da
                        transcrição e a <b>salva no Repositório</b> (Reuniões),
                        com{" "}
                        <span className="font-mono">[[relacionamentos]]</span>{" "}
                        às regras existentes.
                      </p>

                      <div>
                        <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                          Cole a transcrição da reunião
                        </label>
                        <MemoriaTextarea
                          value={texto}
                          onChange={(e) => setTexto(e.target.value)}
                          rows={6}
                          placeholder="Cole aqui a transcrição bruta — a IA formata e gera a ATA…"
                          className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                        />
                      </div>

                      <div>
                        <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                          — ou — envie um arquivo{" "}
                          <span className="text-gray-400">
                            (.txt, .md, .pdf, .docx…)
                          </span>
                        </label>
                        <div className="flex items-center gap-3">
                          <label className="dark:border-dark-500 dark:hover:border-dark-400 text-xs-plus dark:text-dark-200 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-gray-600 hover:border-gray-400">
                            <ArrowUpTrayIcon className="size-4" /> Carregar
                            arquivo
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

                      <div>
                        <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                          Instruções{" "}
                          <span className="text-gray-400">(opcional)</span>
                        </label>
                        <MemoriaInput
                          value={instrucoes}
                          onChange={(e) => setInstrucoes(e.target.value)}
                          placeholder="Ex.: foco nas decisões, destacar prazos…"
                          className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                        />
                      </div>

                      {erro && (
                        <div className="text-xs-plus rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
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
                          <DocumentCheckIcon className="size-5" /> Gerar ATA
                          estratégica
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

      {/* Pergunta pós-upload: gerar atividades ou insights sobre a ata. */}
      <SugerirPosUploadModal
        isOpen={sugerirOpen}
        close={() => setSugerirOpen(false)}
        titulo={titulo}
        conteudo={ata ?? undefined}
      />
    </>
  );
}
