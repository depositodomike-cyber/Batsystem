```tsx
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { getUserAgentOS } from "@/utils/getUserAgentOS";

// Get the current OS
const userOS = getUserAgentOS();
console.log(userOS); // e.g., "Windows", "MacOS", "Linux", "iOS", "Android", etc.`}</SyntaxHighlighter>
    </div>
  );
}

```
