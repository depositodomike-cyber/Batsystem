// Import Dependencies
import { useState } from "react";

// Local Imports
import { Progress, Button } from "@/components/ui";
import { useToggle, useStep } from "@/hooks";
import { COLORS } from "@/constants/app";

// ----------------------------------------------------------------------

const Customizer = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [showRail, setShowRails] = useState<boolean>(true);

  const [currentStep, helpers] = useStep(5);

  const [color, toggleColor] = useToggle(COLORS);

  const { canGoToPrevStep, canGoToNextStep, goToNextStep, goToPrevStep } =
    helpers;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <p>
          <span className="font-medium text-gray-600 dark:text-dark-100">
            {currentStep}
          </span>
          <span> of 5 Task</span>
        </p>
        <div className="flex space-x-2 rtl:space-x-reverse">
          <Button
            onClick={goToPrevStep}
            className="size-7 rounded-full p-0"
            disabled={!canGoToPrevStep}
          >
            -
          </Button>
          <Button
            onClick={goToNextStep}
            className="size-7 rounded-full p-0"
            disabled={!canGoToNextStep}
          >
            +
          </Button>
        </div>
      </div>

      <Progress
        color={color}
        value={currentStep * 20}
        isActive={isActive}
        showRail={showRail}
        className="mt-2"
      />

      <div className="mt-3 flex justify-between">
        <Button onClick={() => toggleColor()}>Color</Button>
        <div className="flex space-x-2 rtl:space-x-reverse">
          <Button onClick={() => setShowRails(!showRail)}>Rail</Button>

          <Button
            color={isActive ? "neutral" : "primary"}
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? "Unactive" : "Activate"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { Customizer };
