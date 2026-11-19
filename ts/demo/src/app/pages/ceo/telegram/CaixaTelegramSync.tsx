// Traz as mensagens do Telegram para as Notas/Repositório enquanto o Oracle
// está aberto: a cada 30 s, ao voltar o foco para a janela e quando a tela de
// Conectores pede. Não faz nada se o conector Telegram não estiver conectado.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import { ehDesktop, ponteDesktop } from "@/utils/desktop";
import { sincronizarCaixaTelegram } from "./caixa-entrada";

const INTERVALO_MS = 30_000;
export const EVENTO_TELEGRAM_SINCRONIZAR = "telegram:sincronizar";

export function CaixaTelegramSync() {
  const { isConnected } = useConnectorsContext();
  const ativo = isConnected("telegram");
  const avisouPermissao = useRef(false);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    const rodar = async () => {
      // No navegador, aba oculta não drena (outra aba pode estar drenando).
      // No Oracle Desktop a janela fica oculta na bandeja e é a única
      // instância: as notas precisam continuar chegando.
      if (cancelado || (document.visibilityState === "hidden" && !ehDesktop())) return;
      try {
        const r = await sincronizarCaixaTelegram();
        if (cancelado) return;
        if (r.novas > 0 && !document.hasFocus()) {
          // Oracle Desktop na bandeja ou ao fundo: avisa pelo Windows também.
          void ponteDesktop()?.notificar(
            "Oracle — Telegram",
            r.novas === 1 ? "Nova nota do Telegram." : `${r.novas} novas notas do Telegram.`,
          );
        }
        if (r.novas > 0) {
          toast.success(
            r.novas === 1 ? "Nova nota do Telegram." : `${r.novas} novas notas do Telegram.`,
            { description: "Veja em Notas → Telegram." },
          );
        }
        if (r.semPermissao && !avisouPermissao.current) {
          avisouPermissao.current = true;
          toast.info("Notas do Telegram aguardando o Repositório.", {
            description: "Abra Notas e clique em “Gravar agora” para liberar a pasta.",
          });
        }
      } catch {
        /* API fora do ar: tenta no próximo ciclo */
      }
    };
    void rodar();
    const t = window.setInterval(() => void rodar(), INTERVALO_MS);
    const aoFocar = () => void rodar();
    window.addEventListener("focus", aoFocar);
    window.addEventListener(EVENTO_TELEGRAM_SINCRONIZAR, aoFocar);
    return () => {
      cancelado = true;
      window.clearInterval(t);
      window.removeEventListener("focus", aoFocar);
      window.removeEventListener(EVENTO_TELEGRAM_SINCRONIZAR, aoFocar);
    };
  }, [ativo]);

  return null;
}
