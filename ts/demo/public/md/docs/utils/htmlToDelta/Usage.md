```tsx
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { htmlToDelta } from "@/utils/htmlToDelta";

const html = "<p>Hello <strong>World</strong>!</p>";
const delta = htmlToDelta(html);

console.log(delta);
// Output: 
// {
//   ops: [
//     { insert: "Hello " },
//     { insert: "World", attributes: { bold: true } },
//     { insert: "!\\n" }
//   ]
// }`}</SyntaxHighlighter>
    </div>
  );
}

```
