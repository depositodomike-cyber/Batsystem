// Import Dependencies
import { ElementType } from "react";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/Breadcrumbs";
import { DemoCard } from "../DemoCard";
import { type ComponentPropsItem, ComponentProps } from "./ComponentProps";
import { type ReturnItem, Returns } from "./Returns";
import { type ParamItem, Params } from "./Params";

// ----------------------------------------------------------------------

export interface Demo {
  title: string;
  description?: string;
  markdownName?: string;
  Component?: ElementType;
}

export interface DemoLayoutProps {
  title?: string;
  markdownPath?: string;
  breadcrumbs?: BreadcrumbItem[];
  demos?: Demo[];
  componentProps?: ComponentPropsItem[];
  returns?: ReturnItem[];
  params?: ParamItem[];
  hasPadding?: boolean;
}

export function DemoLayout(props: DemoLayoutProps) {
  const {
    title = "",
    markdownPath,
    breadcrumbs,
    demos = [],
    componentProps,
    returns,
    params,
    hasPadding = true,
  } = props;
  return (
    <Page title={title}>
      <div
        className={clsx(
          "w-full",
          hasPadding && "transition-content px-(--margin-x) pb-8",
        )}
      >
        <div className="flex items-center space-x-4 py-5 lg:py-6 rtl:space-x-reverse">
          <h2 className="dark:text-dark-50 truncate text-xl font-medium tracking-wide text-gray-800 lg:text-2xl">
            {title}
          </h2>
          <div className="hidden self-stretch py-1 sm:flex">
            <div className="dark:bg-dark-600 h-full w-px bg-gray-300"></div>
          </div>
          <Breadcrumbs items={breadcrumbs} className="max-sm:hidden" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6">
          {demos.map((demo, i) => (
            <DemoCard
              key={i}
              title={demo.title}
              description={demo.description}
              markdownName={demo.markdownName}
              markdownPath={markdownPath}
              Component={demo.Component}
            />
          ))}
        </div>
        {componentProps && componentProps.length > 0 && (
          <ComponentProps properties={componentProps} />
        )}
        {params && params.length > 0 && <Params params={params} />}
        {returns && returns.length > 0 && <Returns returns={returns} />}
      </div>
    </Page>
  );
}
