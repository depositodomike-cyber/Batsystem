import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function IsTokenValid() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { jwt } from "@/utils/jwt";

// Check if a token is valid
if (jwt.isTokenValid()) {
  // Token is valid, continue with authenticated operations
} else {
  // Token is invalid or expired, redirect to login
}`}</SyntaxHighlighter>
    </div>
  );
} 