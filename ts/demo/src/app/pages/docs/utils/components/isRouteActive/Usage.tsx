import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { isRouteActive } from "@/utils/isRouteActive";

// Check if the current route matches "/users"
const isActive = isRouteActive(pathname, "/users");`}</SyntaxHighlighter>
    </div>
  );
} 