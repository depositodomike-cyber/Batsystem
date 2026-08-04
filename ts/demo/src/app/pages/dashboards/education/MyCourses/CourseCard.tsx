// Import Dependencies
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";

// Local Imports
import { Card, Progress } from "@/components/ui";
import { ColorType } from "@/constants/app";

// ----------------------------------------------------------------------

// Define types
type LevelType = "beginner" | "intermediate" | "advanced";

type LevelInfo = {
  label: string;
  color: ColorType;
};

const levels: Record<LevelType, LevelInfo> = {
  beginner: {
    label: "Beginner",
    color: "secondary",
  },
  intermediate: {
    label: "Intermediate",
    color: "warning",
  },
  advanced: {
    label: "Advanced",
    color: "primary",
  },
};

export interface Course {
  id: string;
  title: string;
  teacher: string;
  level: LevelType;
  progress: number;
}

export function CourseCard({ title, teacher, level, progress }: Course) {
  return (
    <Card
      className={clsx(
        `this:${levels[level].color}`,
        "border-this dark:border-this-light flex h-full w-72 shrink-0 flex-col justify-between rounded-xl p-4 ltr:border-l-4 rtl:border-r-4",
      )}
    >
      <div>
        <p className="dark:text-dark-100 line-clamp-2 font-medium tracking-wide text-gray-800">
          {title}
        </p>
        <a
          href="##"
          className="text-xs-plus dark:text-dark-300 dark:hover:text-dark-100 mt-0.5 text-gray-400 hover:text-gray-800"
        >
          {teacher}
        </a>
      </div>

      <div className="mt-6">
        <div className="text-this dark:text-this-lighter text-end">
          {progress}%{" "}
        </div>
        <Progress
          classNames={{
            root: "mt-1 h-1",
          }}
          value={progress}
          color={levels[level].color}
        />

        <div className="text-this dark:text-this-lighter mt-2 flex items-center justify-between">
          <p className="font-medium">{levels[level].label}</p>
          <a href="##" className="hover:opacity-80">
            <ArrowLongRightIcon className="size-5 rtl:rotate-180" />
          </a>
        </div>
      </div>
    </Card>
  );
}
