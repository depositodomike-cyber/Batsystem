// Import Dependencies
import Markdown from "react-markdown";
import { CheckIcon } from "@heroicons/react/20/solid";

// Local Imports
import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";
import { Button, CopyButton } from "@/components/ui";

// ----------------------------------------------------------------------

function Highlight({ children }: { children: string }) {
  return (
    <SyntaxHighlighter className="max-h-[32rem] [direction:ltr]" language="jsx">
      {children}
    </SyntaxHighlighter>
  );
}

function CodeBox({ markdown }: { markdown: string }) {
  return (
    <div className="group relative">
      <CopyButton value={markdown?.replace(/```jsx|```/g, "") || ""}>
        {({ copied, copy }) => (
          <Button
            onClick={copy}
            className="absolute top-0 right-0 mx-6 my-3 flex gap-1 px-2 py-1 text-xs opacity-0 group-hover:opacity-100"
          >
            {copied && <CheckIcon className="text-success-light size-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
        )}
      </CopyButton>
      <div className="mt-6">
        <Markdown
          components={{
            code: Highlight as any,
          }}
        >
          {markdown}
        </Markdown>
      </div>
    </div>
  );
}

export default CodeBox;
