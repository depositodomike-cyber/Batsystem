// Chips de fontes de uma resposta — com URL viram link externo, sem URL viram
// chip do Repositório. Extraído da antiga janela flutuante de resposta.
import clsx from "clsx";
import {
  ArrowTopRightOnSquareIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";

import { fonteLabel, fonteUrl, type Fonte } from "@/services/api/prompt";

// ----------------------------------------------------------------------

export function Fontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {fontes.map((f, i) => {
        const url = fonteUrl(f);
        const label = fonteLabel(f);
        const base =
          "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-tiny";
        if (url) {
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              title={url}
              className={clsx(
                base,
                "dark:border-dark-500 dark:text-dark-200 dark:hover:border-dark-400 border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              <ArrowTopRightOnSquareIcon className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </a>
          );
        }
        return (
          <span
            key={i}
            title={label}
            className={clsx(
              base,
              "border-primary-500/25 text-primary-600 dark:text-primary-400 bg-primary-500/5",
            )}
          >
            <CircleStackIcon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}
