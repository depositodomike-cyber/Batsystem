// Import Dependencies
import { useTimer } from "react-timer-hook";

// ----------------------------------------------------------------------

export function Deadline({ expirySeconds }: { expirySeconds: number }) {
  const time = new Date();
  time.setSeconds(time.getSeconds() + expirySeconds);

  const { seconds, minutes, hours, days } = useTimer({
    expiryTimestamp: time,
  });

  return (
    <div>
      <p className="dark:text-dark-300 text-xs text-gray-400">Ending in</p>
      <div className="dark:text-dark-100 text-base font-medium text-gray-800">
        {days > 0 && `${days}d`} {hours ? hours : "00"}h{" "}
        {minutes ? minutes : "00"}m {days <= 0 && `${seconds ? seconds : 0}s`}
      </div>
    </div>
  );
}
