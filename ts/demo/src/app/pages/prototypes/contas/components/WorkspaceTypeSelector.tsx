/**
 * Radio cards da intenção de uso (Step 2).
 *
 * Representa como o usuário pretende usar a plataforma — não um tipo técnico
 * de organização. O valor escolhido mapeia para o pagador no submit.
 */

import {
  BuildingOffice2Icon,
  UserIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ElementType } from "react";

import {
  WORKSPACE_TYPE_OPTIONS,
  type WorkspaceType,
} from "../screens/workspaceType";

const ICONS: Record<WorkspaceType, ElementType> = {
  personal: UserIcon,
  organization: BuildingOffice2Icon,
};

export function WorkspaceTypeSelector({
  value,
  onChange,
}: {
  value: WorkspaceType;
  onChange: (value: WorkspaceType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Como você pretende utilizar a plataforma"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {WORKSPACE_TYPE_OPTIONS.map((opcao) => {
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
              "flex items-start gap-3 rounded-lg border p-4 text-start transition-colors",
              selecionado
                ? "border-primary-600 bg-primary-600/5 dark:border-primary-400 dark:bg-primary-400/10"
                : "dark:border-dark-600 dark:bg-dark-900 dark:hover:border-dark-500 border-gray-200 bg-white hover:border-gray-300",
            )}
          >
            <span
              className={clsx(
                "grid size-10 shrink-0 place-items-center rounded-lg",
                selecionado
                  ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                  : "dark:bg-dark-700 dark:text-dark-300 bg-gray-100 text-gray-400",
              )}
            >
              <Icon className="size-5" strokeWidth="1.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                {opcao.label}
              </span>
              <span className="dark:text-dark-300 mt-0.5 block text-xs text-gray-400">
                {opcao.description}
              </span>
            </span>
            <span
              className={clsx(
                "mt-1 size-4 shrink-0 rounded-full border-2",
                selecionado
                  ? "border-primary-600 bg-primary-600 dark:border-primary-400 dark:bg-primary-400"
                  : "dark:border-dark-500 border-gray-300",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
