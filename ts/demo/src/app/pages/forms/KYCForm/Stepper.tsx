// Import Dependencies
import clsx from "clsx";
import { HiCheck } from "react-icons/hi";

// Local Imports
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";
import { createScopedKeydownHandler } from "@/utils/dom/createScopedKeydownHandler";
import {
  StepKey,
  useKYCFormContext,
} from "./KYCFormContext";
import { Step } from ".";

// ----------------------------------------------------------------------

interface StepperProps {
  steps: Step[];
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export function Stepper({ steps, currentStep, setCurrentStep }: StepperProps) {
  const { smAndUp } = useBreakpointsContext();
  const kycFormCtx = useKYCFormContext();
  const stepStatus = kycFormCtx.state.stepStatus;
  const stepKeys = Object.keys(kycFormCtx.state.formData) as StepKey[];
  
  return (
    <ol
      className={clsx(
        "steps line-space text-center text-xs sm:text-start sm:text-sm",
        smAndUp && "is-vertical",
      )}
    >
      {steps.map((step, i) => {
        const currentStepActualStatus = stepStatus[step.key];
        const leftSiblingStepKey = getLeftSiblingStep(step.key, stepKeys);

        const isClickable =
          currentStepActualStatus.isDone ||
          (leftSiblingStepKey !== undefined && stepStatus[leftSiblingStepKey]?.isDone);
        return (
          <li
            className={clsx(
              "step",
              currentStep > i
                ? "before:bg-primary-500"
                : "dark:before:bg-dark-500 before:bg-gray-200",
              smAndUp && "items-center pb-8",
            )}
            key={step.key}
          >
            <button
              className={clsx(
                "step-header rounded-full outline-hidden dark:text-white",
                isClickable && "cursor-pointer",
                currentStep === i && "ring-primary-500 ring-2",
                stepStatus[step.key].isDone
                  ? "bg-primary-600 dark:bg-primary-500 dark:ring-offset-dark-900 text-white ring-offset-[3px] ring-offset-gray-100"
                  : "dark:bg-dark-500 bg-gray-200 text-gray-950",
              )}
              {...{
                onClick: isClickable
                  ? () => currentStep !== i && setCurrentStep(i)
                  : undefined,
              }}
              onKeyDown={createScopedKeydownHandler({
                siblingSelector: ".step-header",
                parentSelector: ".steps",
                loop: false,
                orientation: smAndUp ? "vertical" : "horizontal",
                activateOnFocus: true,
              })}
              disabled={!isClickable}
            >
              {stepStatus[step.key].isDone ? (
                <HiCheck className="size-4.5" />
              ) : (
                i + 1
              )}
            </button>
            <h3
              className={clsx(
                "dark:text-dark-100 text-gray-800 sm:text-start",
                smAndUp && "ltr:ml-4 rtl:mr-4",
              )}
            >
              {step.label}
            </h3>
          </li>
        );
      })}
    </ol>
  );
}

function getLeftSiblingStep(stepKey: StepKey, keys: StepKey[]): StepKey | undefined {
  const index = keys.indexOf(stepKey);
  return index < 1 ? undefined : keys[index - 1];
}
