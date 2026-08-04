// Import Dependencies
import { CSSProperties } from "react";

// Local Imports
import AwardsMan from "@/assets/illustrations/awards-man.svg?react";
import { useThemeContext } from "@/app/contexts/theme/context";
import { AwardCard, type Award } from "./AwardCard";

// ----------------------------------------------------------------------

const awards: Award[] = [
  {
    id: "1",
    image: "/images/awards/award-31.svg",
    label: "Advanced Level",
    description: "Lorem ipsum dolor sit amet.",
  },
  {
    id: "2",
    image: "/images/awards/award-27.svg",
    label: "Boss Level",
    description: "Lorem ipsum dolor sit amet.",
  },
  {
    id: "3",
    image: "/images/awards/award-5.svg",
    label: "Expert Level",
    description: "Lorem ipsum dolor sit amet.",
  },
];

export function Awards() {
  const { primaryColorScheme: primary } = useThemeContext();

  return (
    <div className="col-span-12 flex flex-col sm:col-span-6 lg:col-span-4">
      <div className="m-auto px-5">
        <AwardsMan
          className="w-full max-w-xs"
          style={
            {
              "--primary": primary[500],
            } as CSSProperties
          }
        />
      </div>
      <div className="mt-4 space-y-4 sm:mt-5 lg:mt-6">
        {awards.map((award) => (
          <AwardCard key={award.id} {...award} />
        ))}
      </div>
    </div>
  );
}
