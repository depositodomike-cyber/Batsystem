// Import Dependencies
import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";
import { SparklesIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import { IA_MODALS_BY_ID } from "@/app/contexts/ia-modals/registry";
import {
  AiFunction,
  AI_STUDIO_DISABLED,
  FUNCTIONS,
  isAiStudioFunction,
} from "./ia-functions";
import { isMemoryUploadFnTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

function AiCard({
  item,
  onRun,
  disabled,
}: {
  item: AiFunction;
  onRun: (item: AiFunction) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { Icon, tint, id } = item;
  const label = t(`ai.${id}`, { defaultValue: item.label });
  const desc = t(`ai.${id}Desc`, { defaultValue: item.desc });

  return (
    <button
      type="button"
      onClick={() => onRun(item)}
      disabled={disabled}
      title={disabled ? t("ai.unavailable") : undefined}
      className={clsx(
        "dark:border-dark-600 dark:bg-dark-700 group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-start transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "dark:hover:border-dark-400 hover:border-gray-300",
      )}
    >
      <span
        className={clsx(
          "grid size-11 shrink-0 place-items-center rounded-lg bg-current/10",
          tint,
        )}
      >
        <Icon className={clsx("size-6 stroke-[1.5]", tint)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="dark:text-dark-100 block truncate text-sm font-medium text-gray-700">
          {label}
        </span>
        <span className="dark:text-dark-300 mt-0.5 block text-xs-plus text-gray-400">
          {desc}
        </span>
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------

export default function Ia() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const product = getCurrentProduct(pathname);
  const { open } = useIaModals();

  const run = (fn: AiFunction) => {
    if (AI_STUDIO_DISABLED) return;
    if (IA_MODALS_BY_ID[fn.id]) {
      open(fn.id);
      return;
    }
    toast(t(`ai.${fn.id}`, { defaultValue: fn.label }), {
      description: t("ai.unavailable"),
    });
  };

  const fnParam = searchParams.get("fn");
  useEffect(() => {
    if (!fnParam) return;
    const blocked =
      (AI_STUDIO_DISABLED && isAiStudioFunction(fnParam)) ||
      isMemoryUploadFnTemporarilyDisabled(fnParam);
    if (!blocked && IA_MODALS_BY_ID[fnParam]) open(fnParam);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fn");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnParam]);

  return (
    <Page title={`${t("ai.title")} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
            <SparklesIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>{t("ai.help1")}</p>
                    <p>{t("ai.help2")}</p>
                  </>
                ),
              }}
            >
              {t("ai.title")}
            </PageTitle>
            <p className="dark:text-dark-300 text-sm text-gray-400">
              {t("ai.subtitle")}
            </p>
          </div>
        </div>

        <section className="mt-6">
          <h3 className="dark:text-dark-200 mb-3 text-tiny-plus font-semibold uppercase tracking-wider text-gray-500">
            {t("ai.functions")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCTIONS.map((fn) => (
              <AiCard
                key={fn.id}
                item={fn}
                onRun={run}
                disabled={AI_STUDIO_DISABLED}
              />
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
