/**
 * Lista de intenção de uso (Step 2).
 *
 * Representa como o usuário pretende usar a plataforma — não um tipo técnico
 * de organização. O valor escolhido mapeia para o pagador no submit.
 */

import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ElementType } from "react";

import { TIPO_USO_OPTIONS, type TipoUso } from "../screens/tipoUso";

const ICONS: Record<TipoUso, ElementType> = {
  personal: UserIcon,
  organization: BuildingOffice2Icon,
};

export function TipoUsoSelector({
  value,
  onChange,
}: {
  value: TipoUso;
  onChange: (value: TipoUso) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Como você quer usar a beculture"
      className="space-y-2.5"
    >
      {TIPO_USO_OPTIONS.map((opcao) => {
        const selecionado = value === opcao.value;
        const Icon = ICONS[opcao.value];
        return (
          <button
            key={opcao.value}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => onChange(opcao.value)}
            className={clsx(
              "flex w-full items-center gap-3.5 rounded-lg border p-4 text-start transition-colors",
              selecionado
                ? "border-primary-600 bg-primary-600/5 dark:border-primary-400 dark:bg-primary-400/10"
                : "dark:border-dark-600 dark:bg-dark-900 dark:hover:border-dark-500 dark:hover:bg-dark-800 border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
            )}
          >
            <span
              className={clsx(
                "grid size-11 shrink-0 place-items-center rounded-lg",
                selecionado
                  ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                  : "dark:bg-dark-700 dark:text-dark-300 bg-gray-100 text-gray-400",
              )}
            >
              <Icon className="size-6 stroke-[1.5]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                {opcao.label}
              </span>
              <span className="dark:text-dark-300 mt-0.5 block text-xs-plus text-gray-400">
                {opcao.description}
              </span>
            </span>
            {selecionado && (
              <CheckCircleIcon
                className="size-5 shrink-0 text-primary-600 dark:text-primary-400"
                strokeWidth="1.8"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
