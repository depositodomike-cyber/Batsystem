// Bolinha do assistente no canto inferior direito. Sempre disponível: um clique
// abre o painel (restaurando a conversa atual, se houver).
import { useTranslation } from "react-i18next";
import { ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui";
import { useAssistente } from "@/app/contexts/assistente/context";

// ----------------------------------------------------------------------

export function Bubble() {
  const { t } = useTranslation();
  const { open, naoLido, status } = useAssistente();

  return (
    // O halo pulsante fica no wrapper, não no botão: pulsar o próprio botão
    // (como o `animate-pulse` do ditado na PromptBar) apagaria o ícone no vale
    // da animação e daria aparência de desabilitado.
    //
    // `bottom` soma a safe area para não cair sob o home indicator do iPhone
    // (depende do `viewport-fit=cover` na meta viewport).
    <div className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-[105] grid size-14 place-items-center">
      <span
        aria-hidden="true"
        className="bg-primary-500 motion-reduce:hidden absolute inset-0 animate-ping rounded-full opacity-40"
      />
      {/*
       * `Button color="primary"` em vez de classes soltas: o variant filled
       * carrega a cor de texto do design system, e o skin da marca troca essa
       * cor por slate-900 quando o primary é o amber (`.this:primary.bg-this`
       * em beculture-theme.css) — branco sobre amber não passa de contraste.
       * Assim o ícone acompanha a cor do botão sozinho, em qualquer scheme:
       * herda o `currentColor` do botão em vez de ter cor própria, como
       * tinha a marca que estava aqui antes.
       */}
      <Button
        color="primary"
        isIcon
        onClick={open}
        aria-label={t("chrome.assistantOpen")}
        aria-expanded={status === "open"}
        title={t("chrome.assistantOpen")}
        className="relative size-14 rounded-full shadow-lg hover:scale-105"
      >
        <ChatBubbleOvalLeftEllipsisIcon className="size-7 shrink-0" />
        {naoLido && (
          <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </Button>
    </div>
  );
}
