import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function SetSession() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { jwt } from "@/utils/jwt";

// Set user session with a JWT token
jwt.setSession("your-jwt-token-here");`}</SyntaxHighlighter>
    </div>
  );
} 