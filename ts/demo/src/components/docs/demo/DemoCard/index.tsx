// Import Dependencies
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  ElementType,
  ReactNode,
} from "react";
import parse from "html-react-parser";
import { Field, Label } from "@headlessui/react";
import clsx from "clsx";

// Local Imports
import { Card } from "@/components/ui";
import { StyledSwitch } from "@/components/shared/form/StyledSwitch";
const CodeBox = lazy(() => import("./CodeBox"));

// ----------------------------------------------------------------------

export interface DemoCardProps {
  Component?: ElementType;
  title?: string;
  description?: string;
  markdownPath?: string;
  markdownName?: string;
}

function DemoCard(props: DemoCardProps) {
  const { Component, title, description, markdownPath, markdownName } = props;

  const [expanded, setExpanded] = useState<boolean>(false);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchMarkdown = async () => {
      setLoading(true);
      const path = `/md/${markdownPath}/${markdownName}.md`;
      const res = await fetch(path);
      const text = await res.text();
      setMarkdown(text);
      setLoading(false);
    };

    if (!markdown && expanded) {
      fetchMarkdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const component = useMemo<ReactNode>(() => {
    return Component ? <Component /> : null;
  }, [Component]);

  return (
    <Card className="px-4 pb-4 sm:px-5">
      <header className="flex h-14 items-center justify-between space-x-3 py-3 rtl:space-x-reverse">
        <h2 className="dark:text-dark-100 truncate font-medium tracking-wide text-gray-800 lg:text-base">
          {title}
        </h2>
        {markdownName && markdownPath && (
          <Field as="div" className="flex items-center gap-2">
            <Label className="dark:text-dark-300 text-xs text-gray-400">
              Code
            </Label>
            <StyledSwitch
              loading={loading}
              checked={expanded && !!markdown && !loading}
              onChange={setExpanded}
            />
          </Field>
        )}
      </header>

      {description && (
        <div className="inline-code max-w-2xl">{parse(description)}</div>
      )}

      {Component && <div className="mt-5">{component}</div>}

      <div
        className={clsx(
          (!expanded || !markdown || markdown === "") && "hidden",
        )}
      >
        <Suspense>
          <CodeBox markdown={markdown} />
        </Suspense>
      </div>
    </Card>
  );
}

export { DemoCard };
