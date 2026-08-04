import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { msToTime } from "@/utils/msToTime";

// 1000 milliseconds = 1 second
console.log(msToTime(1000)); // Output: "0:00:01"

// 3661000 milliseconds = 1 hour, 1 minute, and 1 second
console.log(msToTime(3661000)); // Output: "1:01:01"`}</SyntaxHighlighter>
    </div>
  );
} 