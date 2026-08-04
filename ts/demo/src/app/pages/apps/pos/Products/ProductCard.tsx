// Local Imports
import { Card } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Product {
  uid: string;
  image: string;
  name: string;
  category: string;
  price: string;
}

export function ProductCard({ image, name, category, price }: Product) {
  return (
    <Card className="group p-2 transition-transform hover:scale-105">
      <img className="rounded-lg" src={image} alt={name} />
      <div className="pt-2">
        <p className="dark:text-dark-100 truncate font-medium text-gray-800">
          {name}
        </p>
        <p className="dark:text-dark-300 truncate text-xs text-gray-400">
          {category}
        </p>
        <p className="text-primary-600 dark:text-primary-400 text-end font-medium">
          ${price}
        </p>
      </div>
      <div className="absolute inset-0 cursor-pointer rounded-lg bg-black/10 opacity-0 transition-colors group-hover:opacity-100" />
    </Card>
  );
}
