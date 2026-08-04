// Import Dependencies
import clsx from "clsx";
import { Getter, Row } from "@tanstack/react-table";

// Local Imports
import { formatNumber } from "@/utils/formatNumber";
import { NFTItem } from "./fakeData";

// ----------------------------------------------------------------------

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function CollectionCell({
  row,
  getValue,
}: {
  row: Row<NFTItem>;
  getValue: Getter<any>;
}) {
  const val = getValue();
  return (
    <div className="flex items-center space-x-4">
      <div className="size-10">
        <img
          src={row.original.collection_image}
          alt={val}
          className="mask is-diamond h-full w-full object-cover object-center"
        />
      </div>
      <span className="dark:text-dark-100 font-medium text-gray-800">
        {val}
      </span>
    </div>
  );
}

export function VolumeCell({ getValue }: { getValue: Getter<any> }) {
  return <> {formatter.format(getValue())}</>;
}

export function Change24hrCell({ getValue }: { getValue: Getter<any> }) {
  const val = getValue();

  return (
    <span
      className={clsx(
        "font-semibold",
        val > 0
          ? "text-success dark:text-success-light"
          : "text-error dark:text-error-light",
      )}
    >
      {val}%
    </span>
  );
}

export function OwnersCell({ getValue }: { getValue: Getter<any> }) {
  return <>{formatNumber(getValue())}</>;
}

export function ItemsCell({ getValue }: { getValue: Getter<any> }) {
  return <>{getValue().toLocaleString("en-US")}</>;
}
