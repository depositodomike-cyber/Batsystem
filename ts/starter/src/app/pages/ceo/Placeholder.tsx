// Import Dependencies
import { useLocation } from "react-router";

// Local Imports
import { Page } from "@/components/shared/Page";
import {
  getCurrentProduct,
  getTitleForPath,
} from "@/app/navigation/ceoOs";

// ----------------------------------------------------------------------

export default function Placeholder() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const title = getTitleForPath(pathname);

  return (
    <Page title={`${title} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex flex-col gap-1">
          <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
            {product.name}
          </p>
          <h2 className="dark:text-dark-50 text-2xl font-semibold tracking-wide text-gray-800">
            {title}
          </h2>
        </div>
        <div className="dark:border-dark-600 dark:bg-dark-700 mt-5 grid h-64 place-items-center rounded-lg border border-dashed border-gray-300 bg-white">
          <p className="dark:text-dark-300 text-sm text-gray-400">
            Conteúdo de “{title}” em construção.
          </p>
        </div>
      </div>
    </Page>
  );
}
