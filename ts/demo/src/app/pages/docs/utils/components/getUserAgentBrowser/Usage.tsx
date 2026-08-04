import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { getUserAgentBrowser } from "@/utils/getUserAgentBrowser";

// Get the current browser
const browser = getUserAgentBrowser();
console.log(browser); // e.g., "Chrome", "Firefox", "Safari", "Edge", etc.`}</SyntaxHighlighter>
    </div>
  );
}
