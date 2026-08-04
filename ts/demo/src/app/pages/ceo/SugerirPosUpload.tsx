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
  XMarkIcon,
  SparklesIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  BoltIcon,
  LightBulbIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { MarkdownView } from "./MarkdownView";
import { perguntarPromptApi } from "@/services/api/prompt";

// ----------------------------------------------------------------------
// Pergunta pós-upload da Memória. Toda vez que um upload é salvo na Memória
// (Documento, Áudio, Transcrição ou a pasta do grafo), este modal pergunta se o
// usuário quer que a IA gere ATIVIDADES ou INSIGHTS a respeito do conteúdo.
// A geração usa o mesmo endpoint /ai/prompt (modo Memória) que a PromptBar.
// ----------------------------------------------------------------------

type Kind = "atividades" | "insights";
type Etapa = "escolha" | "gerando" | "resultado";

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Rótulo do que foi enviado (título do documento/ata/pasta). */
  titulo?: string;
  /** Conteúdo salvo, quando disponível (documento/ata). Sem ele, a IA cruza a
   *  Memória inteira — usado pelo upload de pasta do grafo. */
  conteudo?: string;
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Não foi possível gerar as sugestões. Tente novamente.";
}

const META: Record<
  Kind,
  { label: string; Icon: typeof BoltIcon; tint: string; instrucao: string }
> = {
  atividades: {
    label: "Atividades",
    Icon: BoltIcon,
    tint: "text-amber-500",
    instrucao:
      "Proponha uma lista objetiva de 3 a 6 atividades práticas e acionáveis decorrentes do material. Para cada uma, dê um título curto em negrito e uma frase de contexto (o que fazer e por quê).",
  },
  insights: {
    label: "Insights",
    Icon: LightBulbIcon,
    tint: "text-violet-500",
    instrucao:
      "Destaque de 3 a 6 insights estratégicos relevantes a partir do material. Para cada um, dê um título curto em negrito e uma frase explicando a implicação para o negócio.",
  },
};

export function SugerirPosUploadModal({ isOpen, close, titulo, conteudo }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [kind, setKind] = useState<Kind | null>(null);
  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  const reset = () => {
    setEtapa("escolha");
    setKind(null);
    setResultado("");
    setErro("");
    setCopiado(false);
  };

  const fechar = () => {
    if (etapa === "gerando") return; // não fecha no meio da geração
    close();
  };

  const gerar = async (k: Kind) => {
    setKind(k);
    setErro("");
    setEtapa("gerando");
    const meta = META[k];
    const base = conteudo
      ? `\n\n---\nTítulo: ${titulo || "(sem título)"}\n\nConteúdo:\n${conteudo.slice(0, 8000)}`
      : titulo
        ? `\n\nUse como base o material recém-adicionado à Memória ("${titulo}") e as diretrizes já existentes.`
        : "\n\nUse como base o material recém-adicionado à Memória e as diretrizes já existentes.";
    const texto = `${meta.instrucao} Responda em português do Brasil, em Markdown.${base}`;
    try {
      const data = await perguntarPromptApi({ texto, modo: "vault" });
      setResultado(data.resposta);
      setEtapa("resultado");
    } catch (err) {
      setErro(errMessage(err));
      setEtapa("escolha");
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      toast("Copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast("Não foi possível copiar");
    }
  };

  return (
    <Transition show={isOpen} afterLeave={reset}>
      <Dialog onClose={fechar} className="relative z-[80]">
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
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <SparklesIcon className="size-5 text-primary-500" />
                  Gerar a partir da Memória
                </DialogTitle>
                <Button
                  onClick={fechar}
                  disabled={etapa === "gerando"}
                  variant="flat"
                  isIcon
                  className="size-8 rounded-full"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                {etapa === "escolha" && (
                  <div className="flex flex-col gap-4">
                    <p className="dark:text-dark-200 text-sm text-gray-600">
                      Conteúdo salvo na Memória
                      {titulo ? (
                        <>
                          {" "}
                          — <span className="font-medium">{titulo}</span>
                        </>
                      ) : null}
                      . Quer que a IA gere algo a respeito dele agora?
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(Object.keys(META) as Kind[]).map((k) => {
                        const { label, Icon, tint } = META[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => gerar(k)}
                            className="dark:border-dark-600 dark:hover:border-dark-400 dark:bg-dark-800 group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary-300"
                          >
                            <span
                              className={`grid size-10 shrink-0 place-items-center rounded-lg bg-current/10 ${tint}`}
                            >
                              <Icon className={`size-5.5 stroke-[1.5] ${tint}`} />
                            </span>
                            <span className="min-w-0">
                              <span className="dark:text-dark-100 block text-sm font-semibold text-gray-800">
                                Criar {label.toLowerCase()}
                              </span>
                              <span className="dark:text-dark-300 mt-0.5 block text-xs-plus text-gray-500">
                                {k === "atividades"
                                  ? "Tarefas acionáveis a partir do conteúdo."
                                  : "Sinais estratégicos e implicações."}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button variant="outlined" onClick={fechar}>
                        Agora não
                      </Button>
                    </div>
                  </div>
                )}

                {etapa === "gerando" && (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">
                        Gerando {kind ? META[kind].label.toLowerCase() : "sugestões"} a
                        partir da Memória…
                      </p>
                    </div>
                  </div>
                )}

                {etapa === "resultado" && (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="dark:text-dark-50 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                        {kind && (
                          <>
                            {(() => {
                              const { Icon, tint } = META[kind];
                              return <Icon className={`size-4.5 ${tint}`} />;
                            })()}
                            {META[kind].label} sugeridos
                          </>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setEtapa("escolha")}
                          variant="outlined"
                          className="h-8 gap-1.5 px-2.5 text-xs-plus"
                        >
                          <ArrowLeftIcon className="size-4" /> Voltar
                        </Button>
                        <Button
                          onClick={copiar}
                          variant="outlined"
                          className="h-8 gap-1.5 px-2.5 text-xs-plus"
                        >
                          {copiado ? (
                            <ClipboardDocumentCheckIcon className="size-4 text-emerald-500" />
                          ) : (
                            <ClipboardDocumentIcon className="size-4" />
                          )}
                          Copiar
                        </Button>
                        {kind && (
                          <Button
                            onClick={() => gerar(kind)}
                            variant="outlined"
                            className="h-8 gap-1.5 px-2.5 text-xs-plus"
                          >
                            <ArrowPathIcon className="size-4" /> Regerar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="dark:border-dark-600 border-t border-gray-100 pt-3">
                      <MarkdownView>{resultado}</MarkdownView>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button color="primary" onClick={fechar}>
                        Concluir
                      </Button>
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
