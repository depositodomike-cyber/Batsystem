// Import Dependencies
import { useLocation } from "react-router";
import { RectangleStackIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { CriacoesLista } from "./CriacoesLista";

// ----------------------------------------------------------------------

// Minhas criações — subitem do collapse AI Studio (`/:produto/ia/criacoes`).
// A lista de criações recentes morava na tela /ia; agora tem rota própria e
// reaproveita o mesmo `CriacoesLista`.
export default function MinhasCriacoes() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  return (
    <Page title={`${t("ai.myCreations")} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-11 place-items-center rounded-xl">
            <RectangleStackIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <PageTitle
              help={{
                description: <p>{t("ai.myCreationsHelp")}</p>,
              }}
            >
              {t("ai.myCreations")}
            </PageTitle>
            <p className="dark:text-dark-300 text-sm text-gray-400">
              {t("ai.myCreationsSubtitle")}
            </p>
          </div>
        </div>

        <section className="mt-6">
          <CriacoesLista produto={product.code} />
        </section>
      </div>
    </Page>
  );
}
