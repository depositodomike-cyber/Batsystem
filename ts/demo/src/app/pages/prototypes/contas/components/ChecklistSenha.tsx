import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { avaliarRequisitosSenha } from "./passwordRequirements";

export function ChecklistSenha({
  senha,
  mostrarErros,
}: {
  senha: string;
  /** Quando true, requisitos não atendidos ficam vermelhos (ex.: após submit). */
  mostrarErros: boolean;
}) {
  const requisitos = avaliarRequisitosSenha(senha);

  return (
    <ul
      className="mt-2 space-y-1"
      aria-live="polite"
      aria-label="Requisitos da senha"
    >
      {requisitos.map((requisito) => {
        const pendente = !requisito.atendido && !mostrarErros;
        const falhou = !requisito.atendido && mostrarErros;

        const Icon = requisito.atendido
          ? CheckCircleIcon
          : falhou
            ? XCircleIcon
            : MinusCircleIcon;

        return (
          <li
            key={requisito.id}
            className={clsx(
              "flex items-center gap-2 text-xs-plus transition-colors",
              requisito.atendido &&
                "text-success dark:text-success-lighter",
              pendente && "text-gray-400 dark:text-dark-400",
              falhou && "text-error dark:text-error-lighter",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth="1.8" aria-hidden />
            <span>{requisito.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
