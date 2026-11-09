import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui";

/**
 * Rodapé de uma etapa do wizard.
 *
 * `onDecidirPorMim` só é passado onde a IA realmente resolve sozinha — não
 * existe endpoint que preencha campos, então a ação devolve os campos ao estado
 * vazio, que o backend já lê como "você decide".
 */
export function AcoesEtapa({
  onContinuar,
  onDecidirPorMim,
  rotulo = "Continuar",
  desabilitado = false,
}: {
  onContinuar: () => void;
  onDecidirPorMim?: () => void;
  rotulo?: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {onDecidirPorMim && (
        // `type="button"` obrigatório: dentro de um <form>, o default é submit.
        <Button
          type="button"
          variant="outlined"
          onClick={onDecidirPorMim}
          className="h-9 gap-1.5"
        >
          <SparklesIcon className="size-4" />
          Decidir por mim
        </Button>
      )}
      <Button
        type="button"
        color="primary"
        onClick={onContinuar}
        disabled={desabilitado}
        className="h-9 gap-1.5"
      >
        {rotulo}
        {rotulo === "Continuar" && <ArrowRightIcon className="size-4" />}
      </Button>
    </div>
  );
}
