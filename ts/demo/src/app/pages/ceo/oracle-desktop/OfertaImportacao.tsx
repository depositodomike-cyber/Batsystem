// Primeira abertura do Oracle Desktop com sessão: oferece (uma vez) trazer os
// dados locais do navegador. Na web não faz nada.
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/app/contexts/auth/context";
import { ehDesktop } from "@/utils/desktop";

const CHAVE_OFERECIDA = "oracle-desktop:oferta-importacao";

export function OfertaImportacao() {
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (!ehDesktop() || !isAuthenticated) return;
    try {
      if (localStorage.getItem(CHAVE_OFERECIDA)) return;
      localStorage.setItem(CHAVE_OFERECIDA, new Date().toISOString());
    } catch {
      return;
    }
    // Atraso: o <Toaster/> é lazy e ainda pode não ter montado.
    const t = window.setTimeout(() => {
      toast("Usava o Oracle pelo navegador?", {
        description: "Traga suas notas, conversas e preferências para o app.",
        duration: 15_000,
        action: {
          label: "Importar",
          onClick: () => window.location.assign("/oracle/configuracoes?secao=oracle-desktop"),
        },
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [isAuthenticated]);

  return null;
}
