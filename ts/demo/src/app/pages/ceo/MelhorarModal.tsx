// Import Dependencies
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  SparklesIcon,
  ClipboardDocumentIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { MemoriaTextarea, MemoriaInput } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { melhorarTextoApi } from "@/services/api/melhorar";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { MarkdownView } from "./MarkdownView";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Melhorar texto — portado do beculture/Confi. Reescreve o texto (mais claro e
// forte) sem mudar o sentido. Itera no lugar: cada "Melhorar" substitui o texto
// e mostra o resumo das mudanças; "Desfazer" volta à versão anterior.
// ----------------------------------------------------------------------

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao melhorar o texto. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function MelhorarModal({ isOpen, close, onMinimize }: Props) {
  const [texto, setTexto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [resumo, setResumo] = useState("");
  // Bloco "🔗 Conexões no Vault" da última reescrita — só entra na nota da
  // Memória, nunca no textarea (senão voltaria como texto na próxima rodada).
  const [conexoes, setConexoes] = useState("");
  const [anterior, setAnterior] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Marca/design system ativo — guia o tom da reescrita.
  const design = useActiveDesignSystem();

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota).
  useEffect(() => {
    if (!isOpen) return;
    const pre = takeIaPrefill("melhorar");
    if (pre?.texto) setTexto(pre.texto);
  }, [isOpen]);

  const fechar = () => {
    if (loading) return;
    close();
  };

  const melhorar = async () => {
    setErro("");
    if (!texto.trim()) return setErro("Cole um texto para melhorar.");
    setLoading(true);
    try {
      const data = await melhorarTextoApi({
        texto: texto.trim(),
        instrucoes: instrucoes.trim() || undefined,
        design,
      });
      setAnterior(texto);
      setTexto(data.texto);
      setResumo(data.resumo);
      setConexoes((data.conexoes || "").trim());
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const desfazer = () => {
    if (anterior === null) return;
    setTexto(anterior);
    setAnterior(null);
    setResumo("");
    setConexoes("");
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast("Copiado", { description: "Texto na área de transferência." });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  // Não há título nesta ação — a nota da Memória usa a primeira linha do texto.
  const titulo = texto.trim().split("\n")[0]?.slice(0, 60).trim() || "Texto melhorado";

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
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <SparklesIcon className="size-5" />
                  IA · Melhorar texto
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={loading}
                />
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-3">
                  <DesignSystemBar />

                  {resumo && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs-plus text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <span className="font-medium">Mudanças:</span> {resumo}
                    </div>
                  )}

                  <div>
                    <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Texto</label>
                    <MemoriaTextarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={12}
                      placeholder="Cole aqui o texto que você quer melhorar…"
                      className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                      Instruções <span className="text-gray-400">(opcional)</span>
                    </label>
                    <MemoriaInput
                      value={instrucoes}
                      onChange={(e) => setInstrucoes(e.target.value)}
                      placeholder="Ex.: deixar mais formal, mais curto, mais persuasivo…"
                      className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                    />
                  </div>

                  {/* Conexões que serão gravadas junto da nota (não entram no
                      texto melhorado nem no que o usuário copia). */}
                  {conexoes && (
                    <div className="dark:border-dark-500 dark:bg-dark-800/40 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
                      <MarkdownView>{conexoes}</MarkdownView>
                      <p className="dark:text-dark-300 mt-1 text-xs text-gray-400">
                        Vai junto ao salvar na memória.
                      </p>
                    </div>
                  )}

                  {erro && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                      {erro}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {anterior !== null && (
                        <Button variant="flat" onClick={desfazer} disabled={loading} className="gap-1.5">
                          <ArrowUturnLeftIcon className="size-4" /> Desfazer
                        </Button>
                      )}
                      <Button variant="outlined" onClick={copiar} disabled={!texto.trim()} className="gap-1.5">
                        <ClipboardDocumentIcon className="size-4" /> Copiar
                      </Button>
                      <SalvarNaMemoriaButton
                        pasta={PASTA_MEMORIA.melhorar}
                        titulo={titulo}
                        conteudo={conexoes ? `${texto}\n\n${conexoes}\n` : texto}
                        tags={["texto"]}
                        disabled={!texto.trim() || loading}
                        className="h-auto"
                      />
                      <EnviarParaGrupoButton
                        funcao="melhorar"
                        titulo={titulo}
                        conteudo={texto}
                        disabled={!texto.trim() || loading}
                        className="h-auto"
                      />
                    </div>
                    <Button onClick={melhorar} color="primary" disabled={!texto.trim() || loading} className="gap-2">
                      {loading ? <Spinner className="size-5" /> : <SparklesIcon className="size-5" />}
                      Melhorar
                    </Button>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
