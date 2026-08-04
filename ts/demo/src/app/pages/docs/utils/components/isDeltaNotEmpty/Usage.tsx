import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { isDeltaNotEmpty } from "@/utils/isDeltaNotEmpty";

// Empty delta
const emptyDelta = { ops: [] };
console.log(isDeltaNotEmpty(emptyDelta)); // false

// Delta with only whitespace
const whitespaceOnlyDelta = { ops: [{ insert: "   \\n" }] };
console.log(isDeltaNotEmpty(whitespaceOnlyDelta)); // false

// Delta with actual content
const contentDelta = { ops: [{ insert: "Hello World\\n" }] };
console.log(isDeltaNotEmpty(contentDelta)); // true`}</SyntaxHighlighter>
    </div>
  );
} 