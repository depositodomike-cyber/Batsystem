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
import type { IaModalOpenPayload } from "@/app/contexts/ia-modals/context";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
} from "@/app/data/temporarilyDisabledFeatures";
import { DocumentoUploadPanel } from "./DocumentoUploadPanel";
import { AudioUploadPanel } from "./AudioUploadPanel";
import { TranscricaoUploadPanel } from "./TranscricaoUploadPanel";

// ----------------------------------------------------------------------
// Modal único de Upload — três abas (Documento / Áudio / Transcrições).
// Os painéis ficam montados ao mesmo tempo (inativos escondidos) para não
// perder progresso ao trocar de aba.
// ----------------------------------------------------------------------

export type UploadAba = "documento" | "audio" | "transcricao";

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
  const [busyAudio, setBusyAudio] = useState(false);
  const [busyTranscricao, setBusyTranscricao] = useState(false);

  const busy = busyAudio || busyTranscricao;

  // Deep link / reabertura com payload: sincroniza a aba pedida.
  useEffect(() => {
    if (!isOpen) return;
    setAba(abaInicial(payload));
  }, [isOpen, payload]);

  const fechar = () => {
    if (busy) return;
    close();
  };

  const onBusyAudio = useCallback((v: boolean) => setBusyAudio(v), []);
  const onBusyTranscricao = useCallback(
    (v: boolean) => setBusyTranscricao(v),
    [],
  );

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
                      "inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-xs-plus font-medium transition-colors",
                      aba === id
                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                        : "border-transparent text-gray-500 hover:text-gray-800 dark:text-dark-300 dark:hover:text-dark-100",
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
                  <DocumentoUploadPanel onSubmitted={fechar} />
                </div>
                <div
                  role="tabpanel"
                  hidden={aba !== "audio"}
                  className={clsx(aba !== "audio" && "hidden")}
                >
                  <AudioUploadPanel onBusyChange={onBusyAudio} />
                </div>
                <div
                  role="tabpanel"
                  hidden={aba !== "transcricao"}
                  className={clsx(aba !== "transcricao" && "hidden")}
                >
                  <TranscricaoUploadPanel onBusyChange={onBusyTranscricao} />
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
