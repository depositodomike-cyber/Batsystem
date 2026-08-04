// Import Dependencies
import { useTimer } from "react-timer-hook";

// Local Imports
import { Digit } from "./Digit";

// ----------------------------------------------------------------------

export function Deadline({ expirySeconds }: { expirySeconds: number }) {
  const time = new Date();
  time.setSeconds(time.getSeconds() + expirySeconds);

  const { seconds, minutes, hours } = useTimer({ expiryTimestamp: time });

  return (
    <div className="mt-6">
      <p className="font-medium">Action End in</p>
      <div className="text-primary-600 dark:text-primary-400 mt-3 grid grid-cols-3 gap-3 text-center text-4xl font-semibold">
        <Digit value={hours} />
        <Digit value={minutes} />
        <Digit value={seconds} />
      </div>
      <div className="text-xs-plus mt-2 grid grid-cols-3 gap-3 text-center">
        <p>hours</p>
        <p>minutes</p>
        <p>seconds</p>
      </div>
    </div>
  );
}
