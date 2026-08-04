import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Layouts() {
  return (
    <section>
      <h3
        id="layouts"
        className="dark:border-dark-500 mt-10 scroll-mt-20 border-b border-gray-200 pb-1 text-lg font-semibold lg:text-2xl"
        data-heading="Layouts"
        data-order="2"
      >
        <a href="#layouts">Layouts</a>
      </h3>
      <div className="text-sm-plus mt-5 space-y-3">
        <p className="inline-code">
          beculture provides two distinct layouts: <code>main-layout</code> and{" "}
          <code>sideblock</code>.
        </p>
        <ul className="mt-5 list-outside list-disc space-y-8">
          <li className="ltr:ml-4 rtl:mr-4">
            <strong>Main Layout</strong>
            <div className="mt-2">
              The <code>main-layout</code> is the primary layout and is
              recommended for most applications. It offers a versatile and
              structured design, suitable for settings pages and prebuilt
              applications.
            </div>
            <ul className="mt-5 list-outside list-disc space-y-5">
              <li className="ltr:ml-4 rtl:mr-4">
                <strong>Main Sidebar</strong>
                <div className="mt-2">
                  Serves as the primary navigation hub.
                </div>
              </li>
              <li className="ltr:ml-4 rtl:mr-4">
                <strong>Panel Sidebar</strong>
                <div className="mt-2">
                  Displays options or details depending on the selected item in
                  the main sidebar.
                </div>
              </li>
            </ul>
          </li>
          <li className="ltr:ml-4 rtl:mr-4">
            <strong>Sideblock Layout </strong>
            <div className="inline-code mt-2">
              The <code>sideblock</code> layout is designed for simpler
              applications, dashboards, and admin panels.
            </div>
            <ul className="mt-5 list-outside list-disc space-y-5">
              <li className="ltr:ml-4 rtl:mr-4">
                <strong>Sidebar</strong>
                <div className="mt-2">
                  Includes a single sidebar, making it ideal for use cases with
                  streamlined navigation requirements.
                </div>
              </li>
            </ul>
          </li>
        </ul>
        <p className="inline-code">
          For robust and feature-rich applications, the <code>main-layout</code>{" "}
          is the best choice due to its flexibility and comprehensive navigation
          system. The <code>sideblock</code> layout is well-suited for
          lightweight applications where simplicity and efficiency are
          paramount.
        </p>
        <div>
          <p className="inline-code">
            For chaning the layout, you can update the <code>themeLayout</code>{" "}
            value in the <code>src/confings/theme.ts</code> file.
          </p>
          <div className="mt-4 text-sm">
            <SyntaxHighlighter language="js">
              {`export const defaultTheme = {
    /// ...
    themeLayout: "main-layout",
    /// ...
};`}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    </section>
  );
}
