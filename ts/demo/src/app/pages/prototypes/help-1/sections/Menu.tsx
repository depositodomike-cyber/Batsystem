// Import Dependencies
import clsx from "clsx";
import { Fragment, useState } from "react";
import {
  ArrowTrendingUpIcon,
  CreditCardIcon,
  ReceiptRefundIcon,
  UserIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { TbTruckDelivery, TbCopyright } from "react-icons/tb";

// Local Imports
import { Card } from "@/components/ui";
import { createScopedKeydownHandler } from "@/utils/dom/createScopedKeydownHandler";
import { randomId } from "@/utils/randomId";

interface MenuItemProps {
  active: boolean;
  title: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  Icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const menuItemsGroup: MenuItem[][] = [
  [
    {
      id: randomId(),
      title: "Getting start",
      Icon: ArrowTrendingUpIcon,
    },
    {
      id: randomId(),
      title: "Shipping",
      Icon: TbTruckDelivery,
    },
    {
      id: randomId(),
      title: "Payments",
      Icon: CreditCardIcon,
    },
    {
      id: randomId(),
      title: "Returns",
      Icon: ReceiptRefundIcon,
    },
  ],
  [
    {
      id: randomId(),
      title: "My Account",
      Icon: UserIcon,
    },
    {
      id: randomId(),
      title: "Copyright & Legal",
      Icon: TbCopyright,
    },
    {
      id: randomId(),
      title: "Mobile App",
      Icon: DevicePhoneMobileIcon,
    },
    {
      id: randomId(),
      title: "Security",
      Icon: ShieldCheckIcon,
    },
  ],
  [
    {
      id: randomId(),
      title: "Getting start",
      Icon: ArrowTrendingUpIcon,
    },
    {
      id: randomId(),
      title: "Shipping",
      Icon: TbTruckDelivery,
    },
    {
      id: randomId(),
      title: "Payments",
      Icon: CreditCardIcon,
    },
    {
      id: randomId(),
      title: "Returns",
      Icon: ReceiptRefundIcon,
    },
  ],
];

export function Menu() {
  const [active, setActive] = useState(menuItemsGroup[0][0]);

  return (
    <div className="col-span-12 lg:sticky lg:top-20 lg:col-span-4 lg:self-start xl:col-span-3">
      <Card className="p-4 sm:px-5">
        <div data-menu-list>
          {menuItemsGroup.map((menuItems, i) => (
            <Fragment key={i}>
              {i !== 0 && (
                <div className="dark:bg-dark-500 my-4 h-px bg-gray-200"></div>
              )}
              <ul className="font-inter space-y-3.5 font-medium">
                {menuItems.map((item) => (
                  <MenuItem
                    key={item.id}
                    title={item.title}
                    Icon={item.Icon}
                    active={active === item}
                    onClick={() => setActive(item)}
                  />
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

const MenuItem = ({
  active,
  title,
  onKeyDown,
  Icon,
  ...rest
}: MenuItemProps) => (
  <li>
    <button
      className={clsx(
        "group inline-flex items-center space-x-2 font-medium tracking-wide outline-hidden transition-colors",
        active
          ? "text-primary-600 dark:text-primary-400"
          : "dark:hover:text-dark-100 dark:focus:text-dark-100 hover:text-gray-800 focus:text-gray-800",
      )}
      onKeyDown={createScopedKeydownHandler({
        siblingSelector: "[data-menu-list-item]",
        parentSelector: "[data-menu-list]",
        activateOnFocus: false,
        loop: true,
        orientation: "vertical",
        onKeyDown,
      })}
      data-menu-list-item
      {...rest}
    >
      {Icon && (
        <Icon
          className={clsx(
            "size-4.5 stroke-[1.5]",
            active
              ? "text-primary-600 dark:text-primary-400"
              : "dark:text-dark-300 dark:group-hover:text-dark-200 dark:group-focus:text-dark-200 text-gray-400 transition-colors group-hover:text-gray-500 group-focus:text-gray-500",
          )}
        />
      )}
      <span>{title}</span>
    </button>
  </li>
);
