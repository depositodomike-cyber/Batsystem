/**
 * Controle segmentado.
 *
 * Clone do toggle PJ/PF de `@/app/pages/cadastro` — COM UMA CORREÇÃO: o original
 * usa `bg-primary-500 text-white`, que escapa do seletor
 * `.this\:primary.bg-this` do tema e portanto renderiza branco sobre âmbar,
 * violando a regra de contraste da marca. Aqui o texto ativo é slate.
 */

import clsx from "clsx";

interface SegmentadoProps<T extends string> {
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  onChange: (valor: T) => void;
  /** Rótulo acessível do grupo. */
  ariaLabel?: string;
  disabled?: boolean;
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  ariaLabel,
  disabled = false,
}: SegmentadoProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-dark-500"
    >
      {opcoes.map(([v, label]) => {
        const ativo = valor === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            aria-pressed={ativo}
            onClick={() => onChange(v)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              disabled && "cursor-not-allowed",
              ativo
                ? "bg-primary-500 text-slate-900"
                : "text-gray-500 hover:text-gray-700 dark:text-dark-300 dark:hover:text-dark-100",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
