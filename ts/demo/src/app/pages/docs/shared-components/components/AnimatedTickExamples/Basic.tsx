// Import Dependencies
import { useState } from "react";

// Local Imports
import { AnimatedTick } from "@/components/shared/AnimatedTick";
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

export function Basic() {
  const [state, setState] = useState(false);

  return (
    <div className="flex gap-4">
      <Button onClick={() => setState((val) => !val)}>Toggle Tick</Button>

      {state && (
        <AnimatedTick className="text-primary-600 dark:text-primary-400 size-9" />
      )}
    </div>
  );
}
