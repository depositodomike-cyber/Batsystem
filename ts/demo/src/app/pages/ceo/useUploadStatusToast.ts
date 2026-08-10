import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ----------------------------------------------------------------------
// Toast de status do Upload minimizado: um único toast que nasce carregando e
// vira sucesso/erro no lugar, sem empilhar avisos. Segue a posição global do
// <Toaster/> (por padrão, canto inferior direito).
// ----------------------------------------------------------------------

export interface UploadStatusAcao {
  label: string;
  onClick: () => void;
}

const DURACAO_FINAL = 10000;

export function useUploadStatusToast() {
  const idRef = useRef<string | number | null>(null);
  // A limpeza do unmount não pode apagar um toast que já virou sucesso/erro:
  // o modal se desmonta logo depois de concluir.
  const faseRef = useRef<"ocioso" | "carregando" | "final">("ocioso");

  const mostrarCarregando = useCallback(
    (titulo: string, descricao?: string) => {
      const id = toast.loading(titulo, {
        id: idRef.current ?? undefined,
        description: descricao,
        duration: Infinity,
      });
      idRef.current = id;
      faseRef.current = "carregando";
    },
    [],
  );

  const concluir = useCallback(
    (titulo: string, descricao?: string, acao?: UploadStatusAcao) => {
      toast.success(titulo, {
        id: idRef.current ?? undefined,
        description: descricao,
        duration: DURACAO_FINAL,
        action: acao,
      });
      idRef.current = null;
      faseRef.current = "final";
    },
    [],
  );

  const falhar = useCallback((mensagem: string, acao?: UploadStatusAcao) => {
    toast.error(mensagem, {
      id: idRef.current ?? undefined,
      duration: DURACAO_FINAL,
      action: acao,
    });
    idRef.current = null;
    faseRef.current = "final";
  }, []);

  const encerrar = useCallback(() => {
    if (idRef.current !== null) toast.dismiss(idRef.current);
    idRef.current = null;
    faseRef.current = "ocioso";
  }, []);

  useEffect(
    () => () => {
      if (faseRef.current === "carregando" && idRef.current !== null) {
        toast.dismiss(idRef.current);
      }
    },
    [],
  );

  return { mostrarCarregando, concluir, falhar, encerrar };
}
