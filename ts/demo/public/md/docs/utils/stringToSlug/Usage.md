```tsx
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { stringToSlug } from "@/utils/stringToSlug";

console.log(stringToSlug("Hello, World!")); // Output: "hello-world"
console.log(stringToSlug("CafÃ© Ã  la mode")); // Output: "cafe-a-la-mode"
console.log(stringToSlug("  My String  "));  // Output: "my-string"
console.log(stringToSlug("AÃ±o Nuevo"));     // Output: "ano-nuevo"`}</SyntaxHighlighter>
    </div>
  );
} 
```
