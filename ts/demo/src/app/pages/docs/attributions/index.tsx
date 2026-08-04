// Local Imports
import { Page } from "@/components/shared/Page";
import { Toc } from "@/components/template/Toc";
import { Dependencies } from "./Dependencies";
import { Images } from "./Images";
import { Fonts } from "./Fonts";
import { Icons } from "./Icons";

// ----------------------------------------------------------------------

export default function Attributions() {
  return (
    <Page title="Attributions">
      <div className="transition-content grid grid-cols-4 gap-8 px-(--margin-x) pt-5 pb-16 lg:pt-6 2xl:gap-16">
        <div className="col-span-4 space-y-8 lg:col-span-3" id="attr-root">
          <div className="mx-auto max-w-4xl space-y-8">
            <h1 className="dark:text-dark-50 text-xl font-medium tracking-wide text-gray-800 lg:text-2xl 2xl:text-3xl">
              Attributions
            </h1>
            <Images />
            <Fonts />
            <Icons />
            <Dependencies />
          </div>
        </div>
        <Toc wrapperSelector="#attr-root" />
      </div>
    </Page>
  );
}
