// Import Dependencies
import { useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  CheckIcon,
  HandThumbDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { Radio, Textarea } from "@/components/ui/Form";
import {
  MOTIVOS_FEEDBACK,
  type Insight,
  type InsightFeedback,
  type InsightFeedbackMotivo,
} from "@/app/data/insights";
import { salvarFeedbackInsightApi } from "@/services/api/insights";

// ----------------------------------------------------------------------
// Usado pela tela de Insights e pelo modal de insight aberto a partir das
// Notificações (em qualquer tela).
// ----------------------------------------------------------------------

// 👎 "O que podemos melhorar?" — registra o motivo e, para quem pode orientar
// a IA, oferece transformar o feedback em direcionamento (pré-preenchido; o
// usuário revisa antes de salvar). Mesmo Dialog dos modais da página.

export function FeedbackNegativoModal({
  insight,
  podeOrientar,
  onClose,
  onRegistrado,
  onAdicionarOrientacao,
}: {
  insight: Insight | null;
  podeOrientar: boolean;
  onClose: () => void;
  onRegistrado: (id: string, fb: InsightFeedback) => void;
  onAdicionarOrientacao: (
    insight: Insight,
    motivo: InsightFeedbackMotivo,
  ) => void;
}) {
  const [motivo, setMotivo] = useState<InsightFeedbackMotivo | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // O Dialog segue renderizando o último insight durante a animação de saída.
  const [ultimo, setUltimo] = useState<Insight | null>(null);
  if (insight && insight !== ultimo) setUltimo(insight);
  const alvo = insight ?? ultimo;

  const reset = () => {
    setMotivo(null);
    setComentario("");
    setEnviando(false);
    setEnviado(false);
  };

  const enviar = async () => {
    if (!alvo || !motivo) return;
    setEnviando(true);
    try {
      const fb = await salvarFeedbackInsightApi(alvo.id, {
        util: false,
        motivo,
        ...(motivo === "outro" && comentario.trim()
          ? { comentario: comentario.trim() }
          : {}),
      });
      onRegistrado(alvo.id, fb);
      // Sem sugestão possível (sem permissão, ou "Outro"), fecha direto.
      if (!podeOrientar || motivo === "outro") {
        toast.success("Obrigado pelo feedback.");
        onClose();
      } else {
        setEnviado(true);
      }
    } catch {
      toast.error("Não foi possível registrar o feedback.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Transition show={insight != null} afterLeave={reset}>
      <Dialog onClose={onClose} className="relative z-100">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/50" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="dark:bg-dark-750 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              {/* Header no padrão dos modais da plataforma ("Nova regra"). */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="dark:bg-primary-500/15 bg-primary-50 grid size-10 shrink-0 place-items-center rounded-xl">
                    {enviado ? (
                      <CheckIcon className="text-primary-600 dark:text-primary-400 size-5.5" />
                    ) : (
                      <HandThumbDownIcon className="text-primary-600 dark:text-primary-400 size-5.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      {enviado ? "Obrigado pelo feedback" : "O que podemos melhorar?"}
                    </DialogTitle>
                    {alvo && (
                      <p className="dark:text-dark-300 text-xs-plus line-clamp-1 text-gray-500">
                        {alvo.titulo}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={onClose}
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              {enviado ? (
                <>
                  <p className="dark:text-dark-200 mt-5 text-sm text-gray-600">
                    Quer transformar este feedback em uma orientação para a IA?
                    Você revisa o texto antes de salvar, e ele passa a valer nas
                    próximas análises.
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outlined" className="rounded-lg" onClick={onClose}>
                      Agora não
                    </Button>
                    <Button
                      color="primary"
                      className="rounded-lg"
                      onClick={() => alvo && motivo && onAdicionarOrientacao(alvo, motivo)}
                    >
                      Adicionar orientação
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Um motivo por linha, como opção selecionável — o rótulo
                      do Radio é inline-flex e, solto, as opções se enfileiravam
                      lado a lado. */}
                  <fieldset className="mt-5">
                    <legend className="sr-only">Motivo</legend>
                    <div className="space-y-2">
                      {MOTIVOS_FEEDBACK.map((m) => {
                        const on = motivo === m.value;
                        return (
                          <label
                            key={m.value}
                            className={clsx(
                              "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                              on
                                ? "border-primary-500 bg-primary-50 dark:border-primary-500/60 dark:bg-primary-500/10"
                                : "dark:border-dark-500 dark:bg-dark-700 dark:hover:border-dark-400 border-gray-300 bg-white hover:border-gray-400",
                            )}
                          >
                            <Radio
                              name="motivo-feedback"
                              value={m.value}
                              checked={on}
                              onChange={() => setMotivo(m.value)}
                            />
                            <span className="dark:text-dark-100 text-sm text-gray-700">
                              {m.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {motivo === "outro" && (
                    <div className="mt-4">
                      <Textarea
                        label="Comentário (opcional)"
                        rows={3}
                        maxLength={1000}
                        value={comentario}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          setComentario(e.target.value)
                        }
                        placeholder="Conte o que não funcionou neste insight"
                      />
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outlined" className="rounded-lg" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button
                      color="primary"
                      className="gap-1.5 rounded-lg"
                      disabled={!motivo || enviando}
                      onClick={() => void enviar()}
                    >
                      {enviando && <Spinner color="primary" className="size-4" />}
                      Enviar
                    </Button>
                  </div>
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
