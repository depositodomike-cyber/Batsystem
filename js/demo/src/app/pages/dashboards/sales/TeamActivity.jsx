// Local Imports
import { Card, Timeline, TimelineItem } from "components/ui";
import { randomId } from "utils/randomId";

// ----------------------------------------------------------------------

const timeline = [
  {
    id: randomId(),
    title: "User Photo Changed",
    time: new Date().setMinutes(new Date().getMinutes() - 12),
    content: "John Doe changed his avatar photo",
    color: "neutral",
    isActive: null,
  },
  {
    id: randomId(),
    title: "Video Added",
    time: new Date().setHours(new Date().getHours() - 2),
    content: "Mores Clarke added new video",
    color: "primary",
    isActive: true,
  },
  {
    id: randomId(),
    title: "Design Completed",
    time: new Date().setHours(new Date().getHours() - 3),
    content: "Robert Nolan completed the design of the CRM application",
    color: "success",
    isActive: true,
  },
  {
    id: randomId(),
    title: "ER Diagram",
    time: new Date().setDate(new Date().getDate() - 1),
    content: "Team completed the ER diagram app",
    color: "warning",
    isActive: null,
  },
  {
    id: randomId(),
    title: "Weekly Report",
    time: new Date().setDate(new Date().getDate() - 2),
    content: "The weekly report was uploaded",
    color: "error",
    isActive: true,
  },
];

export function TeamActivity() {
  return (
    <Card className="col-span-12 px-4 pb-4 sm:col-span-6 sm:px-5 lg:col-span-4">
      <div className="flex h-14 min-w-0 items-center justify-between py-3">
        <h2 className="min-w-0 font-medium tracking-wide text-gray-800 dark:text-dark-100">
          Team Activity
        </h2>
        <a
          href="##"
          className="border-b border-dotted border-current pb-0.5 text-xs-plus font-medium text-primary-600 outline-hidden transition-colors duration-300 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70"
        >
          View All
        </a>
      </div>
      <Timeline lineSpace="0.75rem">
        {timeline.map((item) => (
          <TimelineItem
            key={item.id}
            title={item.title}
            time={item.time}
            color={item.color}
            isPing={item.isActive}
          >
            {item.content}
          </TimelineItem>
        ))}
      </Timeline>
    </Card>
  );
}
