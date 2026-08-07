/**
 * Seção Upload: documento, áudio e transcrição.
 */

import clsx from "clsx";

import type { NavigationTree } from "@/@types/navigation";
import { useThemeContext } from "@/app/contexts/theme/context";
import { Collapse } from "@/components/ui";
import { useDisclosure } from "@/hooks";

import { GroupChevron } from "./GroupChevron";
import { MenuItem } from "./Group/MenuItem";

export function UploadSection({
  items,
}: {
  items: NavigationTree[];
}) {
  const { cardSkin } = useThemeContext();
  const [isOpened, { toggle }] = useDisclosure(true);

  if (items.length === 0) return null;

  return (
    <section className="pt-3">
      <div
        className={clsx(
          "sticky top-0 z-10 bg-white px-6",
          cardSkin === "bordered" ? "dark:bg-dark-900" : "dark:bg-dark-750",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          className="dark:text-dark-300 dark:hover:text-dark-50 dark:focus:text-dark-50 mb-1.5 flex w-full cursor-pointer items-center gap-2 pt-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase outline-hidden hover:text-gray-900 focus:text-gray-900"
        >
          <GroupChevron open={isOpened} />
          <span>Upload</span>
        </button>
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-linear-to-b from-white to-transparent",
            cardSkin === "bordered"
              ? "dark:from-dark-900"
              : "dark:from-dark-750",
          )}
        />
      </div>

      <Collapse in={isOpened}>
        <div className="flex flex-col space-y-0.5">
          {items.map((item) =>
            item.type === "item" ? (
              <MenuItem key={item.id} data={item} />
            ) : null,
          )}
        </div>
      </Collapse>
    </section>
  );
}
