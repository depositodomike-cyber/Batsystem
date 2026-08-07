/**
 * Stepper de duas etapas: Conta → Espaço.
 *
 * Clone do `Stepper` de `@/app/pages/onboarding` (mesmas classes de círculo,
 * mesmos estados concluído/ativo/neutro), adaptado para os dois passos deste
 * fluxo. Existe para deixar visualmente óbvio que criar a conta e configurar o
 * espaço (pessoal ou organização) são etapas SEPARADAS.
 */

import { BuildingOffice2Icon, CheckIcon, UserIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

const STEPS = [
  { key: "conta", titulo: "Sua conta", Icon: UserIcon },
  { key: "organizacao", titulo: "Seu espaço", Icon: BuildingOffice2Icon },
] as const;

export function StepperConta({ stepIndex }: { stepIndex: number }) {
  return (
    // Colunas de mesma largura e conector alinhado ao centro do círculo: sem
    // isso os rótulos ("Sua conta" × "Seu workspace") têm larguras diferentes e
    // o eixo dos círculos sai do centro da moldura.
    <div className="mt-6 flex items-start justify-center">
      {STEPS.map((s, i) => {
        const concluido = i < stepIndex;
        const ativo = i === stepIndex;
        return (
          <div key={s.key} className="flex items-start">
            <div className="flex w-9 flex-col items-center gap-1.5 sm:w-28">
              <span
                className={clsx(
                  "flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                  concluido && "border-primary-500 bg-primary-500 text-slate-900",
                  ativo && "border-primary-500 text-primary-600 dark:text-primary-400",
                  !concluido &&
                    !ativo &&
                    "border-gray-200 text-gray-300 dark:border-dark-500 dark:text-dark-400",
                )}
              >
                {concluido ? (
                  <CheckIcon className="size-4" strokeWidth="2.5" />
                ) : (
                  <s.Icon className="size-4.5" strokeWidth="1.8" />
                )}
              </span>
              <span
                className={clsx(
                  "hidden text-center text-xs font-medium sm:block",
                  ativo || concluido
                    ? "text-gray-700 dark:text-dark-100"
                    : "text-gray-400 dark:text-dark-300",
                )}
              >
                {s.titulo}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={clsx(
                  "mx-2 mt-[17px] h-0.5 w-10 rounded sm:w-16",
                  i < stepIndex ? "bg-primary-500" : "bg-gray-200 dark:bg-dark-500",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
