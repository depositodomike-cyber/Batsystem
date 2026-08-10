import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowUpTrayIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import type { IaModalOpenPayload } from "@/app/contexts/ia-modals/context";
import { useDocumentoUpload } from "@/app/contexts/documento-upload/context";
import type { DocumentoUpload } from "@/app/contexts/documento-upload/context";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";
import { DocumentoUploadPanel } from "./DocumentoUploadPanel";
import { AudioUploadPanel } from "./AudioUploadPanel";
import { TranscricaoUploadPanel } from "./TranscricaoUploadPanel";
import { useUploadStatusToast } from "./useUploadStatusToast";

// ----------------------------------------------------------------------
// Modal único de Upload — três abas (Documento / Áudio / Transcrições).
// Os painéis ficam montados ao mesmo tempo (inativos escondidos) para não
// perder progresso ao trocar de aba.
// ----------------------------------------------------------------------

export type UploadAba = "documento" | "audio" | "transcricao";

// Id registrado em ia-modals/registry — usado para restaurar a janela a partir
// do toast de status.
const UPLOAD_MODAL_ID = "upload";

const CONTINUE_NAVEGANDO = "Você pode continuar navegando.";

export interface UploadModalPayload {
  aba?: UploadAba;
}

interface Props {
  isOpen: boolean;
  close: () => void;
  onMinimize?: () => void;
  /** Aba inicial (deep link `?fn=documento|audio|transcricao`). */
  payload?: IaModalOpenPayload;
}

const ABAS: {
  id: UploadAba;
  label: string;
  Icon: typeof DocumentTextIcon;
  disabled?: boolean;
}[] = [
  { id: "documento", label: "Documento", Icon: DocumentTextIcon },
  {
    id: "audio",
    label: "Áudio",
    Icon: MicrophoneIcon,
    disabled: isFeatureTemporarilyDisabled("memoryUploadAudio"),
  },
  {
    id: "transcricao",
    label: "Transcrições",
    Icon: DocumentCheckIcon,
    disabled: isFeatureTemporarilyDisabled("memoryUploadTranscript"),
  },
];

function abaInicial(payload?: IaModalOpenPayload): UploadAba {
  const pedida =
    payload && typeof payload === "object" && "aba" in payload
      ? (payload.aba as UploadAba | undefined)
      : undefined;
  if (!pedida) return "documento";
  const meta = ABAS.find((a) => a.id === pedida);
  if (!meta || meta.disabled) return "documento";
  return pedida;
}

export function UploadModal({ isOpen, close, onMinimize, payload }: Props) {
  const [aba, setAba] = useState<UploadAba>(() => abaInicial(payload));
  const [busyDocumento, setBusyDocumento] = useState(false);
  const [busyAudio, setBusyAudio] = useState(false);
  const [busyTranscricao, setBusyTranscricao] = useState(false);
  const { abrirDocumento } = useDocumentoUpload();
  const { restore } = useIaModals();
  const { mostrarCarregando, concluir, falhar, encerrar } =
    useUploadStatusToast();

  const busy = busyDocumento || busyAudio || busyTranscricao;

  // Deep link / reabertura com payload: sincroniza a aba pedida.
  useEffect(() => {
    if (!isOpen) return;
    setAba(abaInicial(payload));
  }, [isOpen, payload]);

  const abrirUpload = useCallback(() => restore(UPLOAD_MODAL_ID), [restore]);

  // Minimizado, o progresso migra para um toast no rodapé; ao restaurar, o
  // spinner do painel volta a ser a única indicação.
  useEffect(() => {
    if (isOpen) {
      encerrar();
      return;
    }
    if (busyDocumento) {
      mostrarCarregando("Organizando o documento…", CONTINUE_NAVEGANDO);
    } else if (busyAudio) {
      mostrarCarregando("Transcrevendo o áudio…", CONTINUE_NAVEGANDO);
    } else if (busyTranscricao) {
      mostrarCarregando("Gerando a ATA estratégica…", CONTINUE_NAVEGANDO);
    }
  }, [
    isOpen,
    busyDocumento,
    busyAudio,
    busyTranscricao,
    mostrarCarregando,
    encerrar,
  ]);

  const fechar = () => {
    if (busy) return;
    close();
  };

  const onBusyDocumento = useCallback((v: boolean) => setBusyDocumento(v), []);
  const onBusyAudio = useCallback((v: boolean) => setBusyAudio(v), []);
  const onBusyTranscricao = useCallback(
    (v: boolean) => setBusyTranscricao(v),
    [],
  );

  const onDocumentoPronto = useCallback(
    (upload: DocumentoUpload) => {
      // Aberto: termina o fluxo levando direto à tela existente de resultado.
      if (isOpen) {
        encerrar();
        close();
        abrirDocumento(upload);
        return;
      }
      // Minimizado: não interrompe o que o usuário está fazendo; o toast de
      // status vira o aviso de conclusão. Converter antes de `close()`, que
      // desmonta o modal e dispara a limpeza do toast.
      concluir(
        "Documento pronto",
        "O resumo foi criado e está pronto para visualização.",
        { label: "Visualizar", onClick: () => abrirDocumento(upload) },
      );
      close();
    },
    [abrirDocumento, close, concluir, encerrar, isOpen],
  );

  // Áudio e Transcrição mantêm o resultado dentro do modal: quando minimizado,
  // o toast só oferece o caminho de volta para a janela.
  const onResultadoNoModal = useCallback(
    (pronto: string, { titulo, salvo }: { titulo: string; salvo: boolean }) => {
      if (isOpen) return;
      concluir(
        pronto,
        salvo
          ? `${titulo} — guardado no Repositório (Reuniões).`
          : `${titulo} — não foi possível salvar no Repositório.`,
        { label: "Abrir", onClick: abrirUpload },
      );
    },
    [abrirUpload, concluir, isOpen],
  );

  const onAudioPronto = useCallback(
    (r: { titulo: string; salvo: boolean }) =>
      onResultadoNoModal("Resumo do áudio pronto", r),
    [onResultadoNoModal],
  );

  const onTranscricaoPronta = useCallback(
    (r: { titulo: string; salvo: boolean }) =>
      onResultadoNoModal("ATA pronta", r),
    [onResultadoNoModal],
  );

  const onFalha = useCallback(
    (mensagem: string) => {
      if (isOpen) return;
      falhar(mensagem, { label: "Abrir", onClick: abrirUpload });
    },
    [abrirUpload, falhar, isOpen],
  );

  return (
    <Transition show={isOpen} unmount={false}>
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
                  <ArrowUpTrayIcon className="size-5" />
                  Upload
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={busy}
                />
              </div>

              <div
                role="tablist"
                className="dark:border-dark-600 flex gap-1 border-b border-gray-200 px-5 pt-3"
              >
                {ABAS.map(({ id, label, Icon, disabled }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={aba === id}
                    disabled={disabled || (busy && aba !== id)}
                    onClick={() => {
                      if (disabled) return;
                      setAba(id);
                    }}
                    className={clsx(
                      "text-xs-plus inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 font-medium transition-colors",
                      aba === id
                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                        : "dark:text-dark-300 dark:hover:text-dark-100 border-transparent text-gray-500 hover:text-gray-800",
                      disabled && DISABLED_MENU_CLASS,
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                <div
                  role="tabpanel"
                  hidden={aba !== "documento"}
                  className={clsx(aba !== "documento" && "hidden")}
                >
                  <DocumentoUploadPanel
                    onBusyChange={onBusyDocumento}
                    onFinished={onDocumentoPronto}
                    onFailed={onFalha}
                  />
                </div>
                <div
                  role="tabpanel"
                  hidden={aba !== "audio"}
                  className={clsx(aba !== "audio" && "hidden")}
                >
                  <AudioUploadPanel
                    onBusyChange={onBusyAudio}
                    minimizado={!isOpen}
                    onFinished={onAudioPronto}
                    onFailed={onFalha}
                  />
                </div>
                <div
                  role="tabpanel"
                  hidden={aba !== "transcricao"}
                  className={clsx(aba !== "transcricao" && "hidden")}
                >
                  <TranscricaoUploadPanel
                    onBusyChange={onBusyTranscricao}
                    minimizado={!isOpen}
                    onFinished={onTranscricaoPronta}
                    onFailed={onFalha}
                  />
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
