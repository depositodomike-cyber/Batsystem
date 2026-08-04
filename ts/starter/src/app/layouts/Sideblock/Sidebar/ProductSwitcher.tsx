// Import Dependencies
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useLocation, useNavigate } from "react-router";
import clsx from "clsx";

// Local Imports
import {
  products,
  systemProduct,
  getCurrentProduct,
} from "@/app/navigation/ceoOs";

// ----------------------------------------------------------------------

const switcherItems = [...products, systemProduct];

export function ProductSwitcher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = getCurrentProduct(pathname);

  const goTo = (code: string) => {
    if (code === systemProduct.code) navigate("/memoria");
    else navigate(`/${code}`);
  };

  return (
    <Menu as="div" className="relative inline-flex w-full">
      <MenuButton
        className={clsx(
          "dark:hover:bg-dark-300/10 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start outline-hidden transition-colors hover:bg-gray-100",
          "focus-visible:ring-primary-500/50 focus-visible:ring-2",
        )}
      >
        <div className="bg-primary-600 dark:bg-primary-400 grid size-8 shrink-0 place-items-center rounded-lg">
          <span className="text-sm font-bold text-white dark:text-gray-900">
            {current.name.charAt(0)}
          </span>
        </div>
        <span className="dark:text-dark-50 min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
          {current.name}
        </span>
        <ChevronUpDownIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      </MenuButton>
      <Transition
        enter="transition ease-out"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MenuItems
          anchor={{ to: "bottom start", gap: 6 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 w-56 rounded-lg border bg-white p-1 outline-hidden dark:shadow-none"
        >
          <p className="dark:text-dark-300 px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase">
            Produtos
          </p>
          {switcherItems.map((p) => {
            const active = p.code === current.code;
            return (
              <MenuItem key={p.code}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => goTo(p.code)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-sm outline-hidden transition-colors",
                      focus && "dark:bg-dark-600 bg-gray-100",
                      active
                        ? "text-primary-600 dark:text-primary-400 font-semibold"
                        : "dark:text-dark-100 text-gray-800",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {active && <CheckIcon className="size-4 shrink-0" />}
                  </button>
                )}
              </MenuItem>
            );
          })}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
