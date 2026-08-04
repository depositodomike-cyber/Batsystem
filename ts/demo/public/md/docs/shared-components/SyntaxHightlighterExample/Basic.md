```tsx
// Local Imports
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export const Basic = () => {
  return (
    <div>
      <SyntaxHighlighter language="jsx">
        {`import { Button } from "@/components/ui";

const Default = () => {
  return <Button>Default</Button>;
};

export { Default };
`}
      </SyntaxHighlighter>
    </div>
  );
};

```
