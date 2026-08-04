import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { getScrollbarWidth } from "@/utils/getScrollbarWidth";

// Get scrollbar width
const scrollbarWidth = getScrollbarWidth();
console.log(scrollbarWidth); // e.g., 17 (pixels)`}</SyntaxHighlighter>
    </div>
  );
}
