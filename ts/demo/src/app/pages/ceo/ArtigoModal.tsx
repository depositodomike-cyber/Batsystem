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
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea, MemoriaInput } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { MarkdownView } from "./MarkdownView";
import { gerarArtigoApi, type Artigo } from "@/services/api/artigo";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar artigo — portado do beculture/Confi. Geração direta (tema + contexto +
// Memória) e refino iterativo (peça um ajuste; a IA refaz preservando o bom).
// ----------------------------------------------------------------------

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar o artigo. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function ArtigoModal({ isOpen, close, onMinimize }: Props) {
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [usarMemoria, setUsarMemoria] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refinando, setRefinando] = useState(false);
  const [erro, setErro] = useState("");
  const [artigo, setArtigo] = useState<Artigo | null>(null);
  const [ajuste, setAjuste] = useState("");

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota).
  useEffect(() => {
    if (!isOpen) return;
    const pre = takeIaPrefill("artigo");
    if (pre?.tema) setTema(pre.tema);
    if (pre?.contexto) setContexto(pre.contexto);
  }, [isOpen]);

  const fechar = () => {
    if (loading || refinando) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o tema do artigo.");
    setLoading(true);
    try {
      const data = await gerarArtigoApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
      });
      setArtigo(data);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const refazer = async () => {
    if (!artigo || !ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const data = await gerarArtigoApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
        ajuste: ajuste.trim(),
        anterior: artigo,
      });
      setArtigo(data);
      setAjuste("");
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setRefinando(false);
    }
  };

  const novo = () => {
    setArtigo(null);
    setAjuste("");
    setErro("");
  };

  const markdownCompleto = (a: Artigo) =>
    `# ${a.titulo}\n${a.subtitulo ? `\n*${a.subtitulo}*\n` : ""}\n${a.conteudo}`;

  // Corpo da nota do Contexto: artigo + bloco "🔗 Conexões no Vault" (os
  // [[wikilinks]] que ligam a nota aos outros assuntos do vault).
  const notaMemoria = (a: Artigo) =>
    `${a.subtitulo ? `*${a.subtitulo}*\n\n` : ""}${a.conteudo}` +
    (a.conexoes?.trim() ? `\n\n${a.conexoes.trim()}\n` : "");

  const copiar = async () => {
    if (!artigo) return;
    try {
      await navigator.clipboard.writeText(markdownCompleto(artigo));
      toast("Copiado", { description: "Artigo copiado para a área de transferência." });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixar = () => {
    if (!artigo) return;
    // O .md costuma ir para o vault — leva o bloco de conexões junto.
    const md =
      markdownCompleto(artigo) +
      (artigo.conexoes?.trim() ? `\n\n${artigo.conexoes.trim()}\n` : "");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artigo.titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "artigo"}.md`;
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
                  <DocumentTextIcon className="size-5" />
                  IA · Criar artigo
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={loading || refinando}
                />
              </div>

              <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
                {/* Resultado */}
                {artigo ? (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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
                        pasta={PASTA_MEMORIA.artigo}
                        titulo={artigo.titulo}
                        conteudo={notaMemoria(artigo)}
                        tags={["artigo"]}
                      />
                      <EnviarParaGrupoButton
                        funcao="artigo"
                        titulo={artigo.titulo}
                        conteudo={`${artigo.subtitulo ? `*${artigo.subtitulo}*\n\n` : ""}${artigo.conteudo}`}
                      />
                    </div>

                    <h2 className="dark:text-dark-50 text-2xl font-bold text-gray-800">{artigo.titulo}</h2>
                    {artigo.subtitulo && (
                      <p className="dark:text-dark-300 mt-1 text-base text-gray-500">{artigo.subtitulo}</p>
                    )}
                    <div className="dark:border-dark-600 mt-3 border-t border-gray-100 pt-3">
                      <MarkdownView>{artigo.conteudo}</MarkdownView>
                    </div>
                    {artigo.conexoes?.trim() && (
                      <div className="dark:border-dark-600 mt-4 border-t border-gray-100 pt-3">
                        <MarkdownView>{artigo.conexoes.trim()}</MarkdownView>
                      </div>
                    )}

                    {/* Refino iterativo */}
                    <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-5 rounded-xl border border-gray-200 p-3">
                      <label className="dark:text-dark-200 mb-1.5 flex items-center gap-1.5 text-xs-plus font-medium text-gray-600">
                        <SparklesIcon className="size-4" /> Peça um ajuste
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <MemoriaInput
                          value={ajuste}
                          onChange={(e) => setAjuste(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !refinando) refazer();
                          }}
                          disabled={refinando}
                          placeholder="Ex.: mais curto, mais formal, foque em exemplos práticos…"
                          className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                        />
                        <Button onClick={refazer} color="primary" disabled={!ajuste.trim() || refinando} className="gap-2">
                          {refinando ? <Spinner className="size-4" /> : <ArrowPathIcon className="size-4" />}
                          Refazer
                        </Button>
                      </div>
                      {erro && <p className="mt-2 text-xs-plus text-rose-500">{erro}</p>}
                    </div>
                  </div>
                ) : loading ? (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">A IA está escrevendo o artigo…</p>
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
                        Tema do artigo <span className="text-rose-500">*</span>
                      </label>
                      <MemoriaTextarea
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        rows={2}
                        placeholder="Ex.: Como conduzir reuniões que geram decisões"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Contexto / instruções <span className="text-gray-400">(opcional)</span>
                      </label>
                      <MemoriaTextarea
                        value={contexto}
                        onChange={(e) => setContexto(e.target.value)}
                        rows={3}
                        placeholder="Público, tom, pontos que não podem faltar, extensão desejada…"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                      <Checkbox checked={usarMemoria} onChange={(e) => setUsarMemoria(e.target.checked)} className="size-4" />
                      Usar o Contexto como referência
                    </label>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button type="submit" color="primary" disabled={!tema.trim()} className="gap-2">
                        <DocumentTextIcon className="size-5" />
                        Gerar artigo
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
