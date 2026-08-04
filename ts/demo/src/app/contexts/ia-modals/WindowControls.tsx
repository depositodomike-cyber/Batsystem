// Import Dependencies
import { MinusIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------
// Controles de janela do cabeçalho dos modais de IA: minimizar (recolhe para o
// dock no rodapé, preservando o estado) e fechar (descarta).
//
// Minimizar nunca fica desabilitado — é justamente durante uma geração em
// andamento (quando fechar está bloqueado) que recolher a janela é útil.
// `onMinimize` é opcional: sem o host global (<IaModalsHostProvider>) o modal
// mostra só o botão de fechar, como antes.
// ----------------------------------------------------------------------

interface Props {
  onMinimize?: () => void;
  onClose: () => void;
  closeDisabled?: boolean;
}

export function WindowControls({ onMinimize, onClose, closeDisabled }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onMinimize && (
        <Button
          onClick={onMinimize}
          variant="flat"
          isIcon
          className="size-8 rounded-full"
          aria-label="Minimizar"
          title="Minimizar para o rodapé"
        >
          <MinusIcon className="size-5" />
        </Button>
      )}
      <Button
        onClick={onClose}
        disabled={closeDisabled}
        variant="flat"
        isIcon
        className="size-8 rounded-full"
        aria-label="Fechar"
      >
        <XMarkIcon className="size-5" />
      </Button>
    </div>
  );
}
