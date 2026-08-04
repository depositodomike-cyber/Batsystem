export function Digit({ value }: { value: number }) {
  const leftDigit = value >= 10 ? value.toString()[0] : "0";
  const rightDigit = value >= 10 ? value.toString()[1] : value.toString();

  return (
    <div className="grid grid-cols-2 gap-1">
      <div className="bg-primary-600/10 dark:bg-primary-400/10 rounded-lg py-3">
        {leftDigit}
      </div>
      <div className="bg-primary-600/10 dark:bg-primary-400/10 rounded-lg py-3">
        {rightDigit}
      </div>
    </div>
  );
}
