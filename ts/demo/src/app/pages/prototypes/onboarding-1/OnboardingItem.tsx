// Import Dependencies
import { Link } from "react-router";

// Local Imports
import { Button, Card } from "@/components/ui";
import { useThemeContext } from "@/app/contexts/theme/context";
import { Item } from "./items";

// ----------------------------------------------------------------------

export function OnboardingItem({
  title,
  Image,
  description,
  action,
  actionLabel,
}: Item) {
  const { primaryColorScheme: primary, darkColorScheme: dark } =
    useThemeContext();

  return (
    <Card>
      <div className="flex justify-center p-5">
        <Image
          className="h-auto w-9/12"
          style={{ "--primary": primary[500], "--darker": dark[500] }}
        />
      </div>
      <div className="px-4 pb-8 text-center sm:px-5">
        <h4 className="dark:text-dark-100 text-lg font-semibold text-gray-800">
          {title}
        </h4>
        <p className="pt-3">{description}</p>
        <Button
          className="mt-8"
          color="primary"
          component={Link}
          to={action}
          isGlow
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
