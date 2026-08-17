// Import Dependencies
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  PresentationChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea, MemoriaInput } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import {
  gerarRoteiroApi,
  gerarPptxApi,
  gerarHtmlApi,
  type Formato,
  type Roteiro,
} from "@/services/api/apresentacao";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar apresentação — fluxo de 2 etapas portado do beculture/Confi:
//   1) formulário (tema, formato, nº, público/objetivo/tom) → roteiro da IA
//   2) roteiro editável (reordena/edita/adiciona) → gera .pptx ou HTML
// ----------------------------------------------------------------------

const FORMATOS: { id: Formato; label: string; desc: string }[] = [
  { id: "pptx", label: "PowerPoint (.pptx)", desc: "Baixa um arquivo para PowerPoint/Keynote/Slides." },
  { id: "slides-html", label: "Slides HTML", desc: "Passador de página no navegador (setas/clique)." },
  { id: "book-html", label: "Book HTML", desc: "Documento de leitura com menu de capítulos." },
];

const TONS: [string, string][] = [
  ["executivo", "Executivo"],
  ["didatico", "Didático"],
  ["inspirador", "Inspirador"],
  ["comercial", "Comercial"],
  ["tecnico", "Técnico"],
];

const QTDS = [0, 5, 7, 10, 12, 15, 20];

type Step = "form" | "roteiro" | "editor" | "arquivo";

interface EdSlide {
  titulo: string;
  bulletsText: string;
  notas: string;
}
interface EdCap {
  titulo: string;
  parasText: string;
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function ApresentacaoModal({ isOpen, close, onMinimize }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [erro, setErro] = useState("");

  // Marca/design system ativo — vale para o roteiro e para o arquivo gerado
  // (cores, fontes e logo do .pptx / HTML saem daqui).
  const design = useActiveDesignSystem();

  // Formulário (etapa 1)
  const [tema, setTema] = useState("");
  const [formato, setFormato] = useState<Formato>("pptx");
  const [nSlides, setNSlides] = useState(0);
  const [publico, setPublico] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [tom, setTom] = useState("executivo");
  const [usarMemoria, setUsarMemoria] = useState(false);

  // Roteiro (etapa 2)
  const [deckTitulo, setDeckTitulo] = useState("");
  const [deckSub, setDeckSub] = useState("");
  const [edSlides, setEdSlides] = useState<EdSlide[]>([]);
  const [edCaps, setEdCaps] = useState<EdCap[]>([]);
  // Bloco "🔗 Conexões no Vault" da geração — guardado à parte do roteiro
  // editável; só entra na nota do Repositório.
  const [conexoes, setConexoes] = useState("");

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota).
  useEffect(() => {
    if (!isOpen) return;
    const pre = takeIaPrefill("apresentacao");
    if (pre?.tema) setTema(pre.tema);
    if (pre?.contexto) setObjetivo(pre.contexto);
  }, [isOpen]);

  const isBook = formato === "book-html";
  const unidade = isBook ? "capítulos" : "slides";
  const busy = step === "roteiro" || step === "arquivo";

  const resetTudo = () => {
    setStep("form");
    setErro("");
    setEdSlides([]);
    setEdCaps([]);
    setDeckTitulo("");
    setDeckSub("");
    setConexoes("");
  };

  const fecharTudo = () => {
    if (busy) return;
    close();
  };

  // ---- Etapa 1 → roteiro ----
  const gerarRoteiro = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o tema da apresentação.");
    setStep("roteiro");
    try {
      const { roteiro } = await gerarRoteiroApi({
        tema: tema.trim(),
        formato,
        nSlides,
        publico: publico.trim() || undefined,
        objetivo: objetivo.trim() || undefined,
        tom,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
      });
      setDeckTitulo(roteiro.titulo);
      setDeckSub(roteiro.subtitulo);
      setConexoes((roteiro.conexoes || "").trim());
      if (isBook) {
        setEdCaps(
          (roteiro.capitulos ?? []).map((c) => ({
            titulo: c.titulo,
            parasText: (c.paragrafos ?? []).join("\n\n"),
          })),
        );
      } else {
        setEdSlides(
          (roteiro.slides ?? []).map((s) => ({
            titulo: s.titulo,
            bulletsText: (s.bullets ?? []).join("\n"),
            notas: s.notas ?? "",
          })),
        );
      }
      setStep("editor");
    } catch (err) {
      setErro(errMessage(err));
      setStep("form");
    }
  };

  // ---- Monta o roteiro final a partir do editor ----
  const montarRoteiro = (): Roteiro => {
    const base = {
      titulo: deckTitulo.trim() || "Apresentação",
      subtitulo: deckSub.trim(),
      // Bloco "🔗 Conexões no Vault" da geração: não é editável no roteiro e não
      // entra no .pptx/.html — só na nota do Repositório.
      conexoes,
    };
    if (isBook) {
      return {
        ...base,
        capitulos: edCaps
          .map((c) => ({
            titulo: c.titulo.trim(),
            paragrafos: c.parasText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
          }))
          .filter((c) => c.titulo || c.paragrafos.length),
      };
    }
    return {
      ...base,
      slides: edSlides
        .map((s) => ({
          titulo: s.titulo.trim(),
          bullets: s.bulletsText.split("\n").map((b) => b.trim()).filter(Boolean),
          notas: s.notas.trim() || undefined,
        }))
        .filter((s) => s.titulo || s.bullets.length),
    };
  };

  const podeGerar = useMemo(
    () => (isBook ? edCaps.length > 0 : edSlides.length > 0),
    [isBook, edCaps, edSlides],
  );

  // ---- Etapa 2 → arquivo ----
  const gerarArquivo = async () => {
    setErro("");
    const roteiro = montarRoteiro();
    const vazio = isBook ? !roteiro.capitulos?.length : !roteiro.slides?.length;
    if (vazio) return setErro(`Adicione ao menos um ${isBook ? "capítulo" : "slide"}.`);
    setStep("arquivo");
    try {
      const nome = (roteiro.titulo || "apresentacao").replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "apresentacao";
      if (formato === "pptx") {
        const blob = await gerarPptxApi(roteiro, design);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nome}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Apresentação gerada", { description: `${nome}.pptx baixado.` });
      } else {
        const html = await gerarHtmlApi(formato, roteiro, design);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        // Também oferece download do .html
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nome}.html`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast("Apresentação gerada", { description: "Aberta em nova aba e baixada (.html)." });
      }
      setStep("editor");
    } catch (err) {
      setErro(errMessage(err));
      setStep("editor");
    }
  };

  // ---- Memória ----
  // A nota guarda o roteiro em Markdown (é o que o grafo lê) e anexa o arquivo
  // do formato escolhido — .pptx ou .html, gerado no mesmo backend do download.
  const prepararMemoria = async () => {
    const roteiro = montarRoteiro();
    const corpo = isBook
      ? (roteiro.capitulos ?? []).map((c, i) => `## ${i + 1}. ${c.titulo}\n\n${c.paragrafos.join("\n\n")}`).join("\n\n")
      : (roteiro.slides ?? [])
          .map((s, i) => {
            const bullets = s.bullets.map((b) => `- ${b}`).join("\n");
            return `## ${i + 1}. ${s.titulo}\n\n${bullets}${s.notas ? `\n\n> ${s.notas}` : ""}`;
          })
          .join("\n\n");
    const cabecalho = roteiro.subtitulo ? `*${roteiro.subtitulo}*\n\n` : "";

    const dados =
      formato === "pptx"
        ? await gerarPptxApi(roteiro, design)
        : new Blob([await gerarHtmlApi(formato, roteiro, design)], { type: "text/html" });
    return {
      conteudo:
        cabecalho + corpo + (roteiro.conexoes?.trim() ? `\n\n${roteiro.conexoes.trim()}\n` : ""),
      anexos: [{ nome: formato === "pptx" ? "deck.pptx" : "deck.html", dados }],
    };
  };

  // ---- Helpers de reordenação/edição ----
  const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <Transition show={isOpen}>
      <Dialog onClose={fecharTudo} className="relative z-[70]">
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
                  <PresentationChartBarIcon className="size-5" />
                  IA · Criar apresentação
                  {step === "editor" && (
                    <span className="dark:bg-dark-600 dark:text-dark-200 ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                      Roteiro editável
                    </span>
                  )}
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fecharTudo}
                  closeDisabled={busy}
                />
              </div>

              <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
                {/* Etapa 1 — formulário */}
                {step === "form" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      gerarRoteiro();
                    }}
                    className="flex flex-col gap-3"
                  >
                    <DesignSystemBar />

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Tema da apresentação <span className="text-rose-500">*</span>
                      </label>
                      <MemoriaTextarea
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        rows={2}
                        placeholder="Ex.: Plano estratégico 2026 para o conselho"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1.5 block text-xs-plus font-medium text-gray-600">Formato de saída</label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {FORMATOS.map((f) => {
                          const on = formato === f.id;
                          return (
                            <button
                              type="button"
                              key={f.id}
                              onClick={() => setFormato(f.id)}
                              className={clsx(
                                "rounded-lg border p-3 text-start transition-colors",
                                on
                                  ? "border-primary-500 bg-primary-500/5"
                                  : "dark:border-dark-600 dark:hover:border-dark-400 border-gray-200 hover:border-gray-300",
                              )}
                            >
                              <span className={clsx("block text-xs-plus font-semibold", on ? "text-primary-600 dark:text-primary-400" : "dark:text-dark-100 text-gray-800")}>
                                {f.label}
                              </span>
                              <span className="dark:text-dark-300 mt-0.5 block text-tiny text-gray-400">{f.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                          Quantidade de {unidade}
                        </label>
                        <select
                          value={nSlides}
                          onChange={(e) => setNSlides(Number(e.target.value))}
                          className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          {QTDS.map((q) => (
                            <option key={q} value={q}>
                              {q === 0 ? "A IA decide" : `${q} ${unidade}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Tom</label>
                        <select
                          value={tom}
                          onChange={(e) => setTom(e.target.value)}
                          className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          {TONS.map(([id, nome]) => (
                            <option key={id} value={id}>
                              {nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Público-alvo <span className="text-gray-400">(opcional)</span>
                      </label>
                      <MemoriaInput
                        value={publico}
                        onChange={(e) => setPublico(e.target.value)}
                        placeholder="Ex.: conselho de administração"
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Objetivo <span className="text-gray-400">(opcional)</span>
                      </label>
                      <MemoriaTextarea
                        value={objetivo}
                        onChange={(e) => setObjetivo(e.target.value)}
                        rows={2}
                        placeholder="O que a apresentação precisa alcançar?"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                      <Checkbox checked={usarMemoria} onChange={(e) => setUsarMemoria(e.target.checked)} className="size-4" />
                      Usar o Repositório como referência
                    </label>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button type="submit" color="primary" disabled={!tema.trim()} className="gap-2">
                        <PresentationChartBarIcon className="size-5" />
                        Gerar roteiro
                      </Button>
                    </div>
                  </form>
                )}

                {/* Loading (roteiro / arquivo) */}
                {busy && (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">
                        {step === "roteiro"
                          ? "A IA está montando o roteiro…"
                          : "Gerando o arquivo…"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Etapa 2 — editor do roteiro */}
                {step === "editor" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={deckTitulo}
                        onChange={(e) => setDeckTitulo(e.target.value)}
                        placeholder="Título"
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold placeholder:text-gray-400"
                      />
                      <input
                        value={deckSub}
                        onChange={(e) => setDeckSub(e.target.value)}
                        placeholder="Subtítulo"
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    {/* Slides */}
                    {!isBook &&
                      edSlides.map((s, i) => (
                        <div key={i} className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="dark:bg-dark-600 dark:text-dark-200 grid size-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500">{i + 1}</span>
                            <input
                              value={s.titulo}
                              onChange={(e) => setEdSlides((a) => a.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))}
                              placeholder="Título do slide"
                              className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium placeholder:text-gray-400"
                            />
                            <IconBtn label="Subir" onClick={() => setEdSlides((a) => move(a, i, -1))}><ArrowUpIcon className="size-4" /></IconBtn>
                            <IconBtn label="Descer" onClick={() => setEdSlides((a) => move(a, i, 1))}><ArrowDownIcon className="size-4" /></IconBtn>
                            <IconBtn label="Remover" danger onClick={() => setEdSlides((a) => a.filter((_, k) => k !== i))}><TrashIcon className="size-4" /></IconBtn>
                          </div>
                          <MemoriaTextarea
                            value={s.bulletsText}
                            onChange={(e) => setEdSlides((a) => a.map((x, k) => (k === i ? { ...x, bulletsText: e.target.value } : x)))}
                            rows={3}
                            placeholder="Um tópico por linha"
                            className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs-plus placeholder:text-gray-400"
                          />
                          <MemoriaTextarea
                            value={s.notas}
                            onChange={(e) => setEdSlides((a) => a.map((x, k) => (k === i ? { ...x, notas: e.target.value } : x)))}
                            rows={1}
                            placeholder="Notas do apresentador (opcional)"
                            className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-300 mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500 placeholder:text-gray-400"
                          />
                        </div>
                      ))}

                    {/* Capítulos (book) */}
                    {isBook &&
                      edCaps.map((c, i) => (
                        <div key={i} className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="dark:bg-dark-600 dark:text-dark-200 grid size-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500">{i + 1}</span>
                            <input
                              value={c.titulo}
                              onChange={(e) => setEdCaps((a) => a.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))}
                              placeholder="Título do capítulo"
                              className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium placeholder:text-gray-400"
                            />
                            <IconBtn label="Subir" onClick={() => setEdCaps((a) => move(a, i, -1))}><ArrowUpIcon className="size-4" /></IconBtn>
                            <IconBtn label="Descer" onClick={() => setEdCaps((a) => move(a, i, 1))}><ArrowDownIcon className="size-4" /></IconBtn>
                            <IconBtn label="Remover" danger onClick={() => setEdCaps((a) => a.filter((_, k) => k !== i))}><TrashIcon className="size-4" /></IconBtn>
                          </div>
                          <MemoriaTextarea
                            value={c.parasText}
                            onChange={(e) => setEdCaps((a) => a.map((x, k) => (k === i ? { ...x, parasText: e.target.value } : x)))}
                            rows={5}
                            placeholder="Parágrafos (separe por uma linha em branco)"
                            className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs-plus placeholder:text-gray-400"
                          />
                        </div>
                      ))}

                    <Button
                      variant="outlined"
                      onClick={() =>
                        isBook
                          ? setEdCaps((a) => [...a, { titulo: "", parasText: "" }])
                          : setEdSlides((a) => [...a, { titulo: "", bulletsText: "", notas: "" }])
                      }
                      className="gap-2 self-start"
                    >
                      <PlusIcon className="size-5" /> Adicionar {isBook ? "capítulo" : "slide"}
                    </Button>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="dark:border-dark-600 dark:bg-dark-700 sticky bottom-0 -mx-5 flex items-center justify-between border-t border-gray-100 bg-white px-5 pt-3 pb-1">
                      <Button variant="flat" onClick={resetTudo} className="gap-1.5">
                        <ArrowLeftIcon className="size-4" /> Refazer
                      </Button>
                      <div className="flex flex-wrap items-center gap-2">
                        <SalvarNaMemoriaButton
                          pasta={PASTA_MEMORIA.apresentacao}
                          titulo={deckTitulo || "Apresentação"}
                          tags={["apresentação"]}
                          versao={edSlides.length + edCaps.length}
                          disabled={!podeGerar}
                          preparar={prepararMemoria}
                          className="h-auto"
                        />
                        <EnviarParaGrupoButton
                          funcao="apresentacao"
                          titulo={deckTitulo || "Apresentação"}
                          versao={edSlides.length + edCaps.length}
                          disabled={!podeGerar}
                          preparar={prepararMemoria}
                          className="h-auto"
                        />
                        <Button color="primary" onClick={gerarArquivo} disabled={!podeGerar} className="gap-2">
                          {formato === "pptx" ? <ArrowDownTrayIcon className="size-5" /> : <ArrowTopRightOnSquareIcon className="size-5" />}
                          {formato === "pptx" ? "Baixar .pptx" : "Abrir apresentação"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function IconBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "dark:hover:bg-dark-600 grid size-7 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100",
        danger ? "hover:text-rose-500" : "hover:text-gray-700 dark:hover:text-dark-100",
      )}
    >
      {children}
    </button>
  );
}
