import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function DevelopmentServer() {
  return (
    <section>
      <h3
        id="development-server"
        className="dark:border-dark-500 mt-10 scroll-mt-20 border-b border-gray-200 pb-1 text-lg font-semibold lg:text-2xl"
        data-heading="Development Server"
        data-order="2"
      >
        <a href="#development-server">Development Server</a>
      </h3>
      <div className="text-sm-plus mt-5 space-y-4">
        <p>
          After installing all the necessary dependencies, you can launch the
          development server by running the following command in your terminal:
        </p>
        <div className="text-sm">
          <SyntaxHighlighter language="bash">yarn dev</SyntaxHighlighter>
        </div>
        <p>
          Once the server is running, open your browser and navigate to{" "}
          <a
            href="http://localhost:5173/"
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            http://localhost:5173/
          </a>{" "}
          The application will automatically reload whenever you make changes to
          the source files, providing a seamless development experience.
        </p>
      </div>
    </section>
  );
}
