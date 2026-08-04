```tsx
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { isServer } from "@/utils/isServer";

// Conditionally execute code based on environment
if (isServer) {
  // Execute server-side only code
} else {
  // Execute client-side only code
}`}</SyntaxHighlighter>
    </div>
  );
} 
```
