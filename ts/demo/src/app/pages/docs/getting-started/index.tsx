// Local Imports
import { Page } from "@/components/shared/Page";
import { Toc } from "@/components/template/Toc";
import { Hero } from "./Hero";
import { Introduction } from "./introduction";
import { Prerequisite } from "./Prerequisite";
import { Installation } from "./Installation";
import { Layouts } from "./Layouts";
import { DevelopmentServer } from "./DevelopmentServer";
import { CSS } from "./CSS";
import { ThemeConfig } from "./ThemeConfig";
import { FolderStructure } from "./FolderStructure";
import { Internationalization } from "./Internationalization";
import { Customization } from "./Customization";
import { ProductionBuild } from "./ProductionBuild";
import { Starter } from "./Starter";

// ----------------------------------------------------------------------

export default function GettingStarted() {
  return (
    <Page title="Getting Started">
      <div className="transition-content grid grid-cols-4 gap-8 px-(--margin-x) pt-5 pb-16 lg:pt-6 2xl:gap-16">
        <div className="col-span-4 space-y-8 lg:col-span-3" id="doc-root">
          <div className="mx-auto max-w-4xl space-y-8">
            <h1 className="dark:text-dark-50 text-xl font-medium tracking-wide text-gray-800 lg:text-2xl 2xl:text-3xl">
              Getting Started
            </h1>

            <Hero />
            <Introduction />
            <Prerequisite />
            <Installation />
            <Layouts />
            <DevelopmentServer />
            <CSS />
            <ThemeConfig />
            <FolderStructure />
            <Internationalization />
            <Customization />
            <Starter />
            <ProductionBuild />
          </div>
        </div>
        <Toc wrapperSelector="#doc-root" />
      </div>
    </Page>
  );
}
