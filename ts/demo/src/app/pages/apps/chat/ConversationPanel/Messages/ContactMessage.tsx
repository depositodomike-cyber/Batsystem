// Import Dependencies
import clsx from "clsx";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Local Imports
import { useLocaleContext } from "@/app/contexts/locale/context";
import { Avatar, Box } from "@/components/ui";
import { MessageType } from ".";
import { User } from "../../data";

// ----------------------------------------------------------------------

dayjs.extend(relativeTime);

export function ContactMessage(props: MessageType & { profile: User }) {
  const { message, i, profile, isLastMessageOfGroup, isFirstMessageOfGroup } =
    props;

  const isLast = isLastMessageOfGroup(message, i);
  const isFirst = isFirstMessageOfGroup(message, i);
  const { locale } = useLocaleContext();

  const formattedTime = dayjs(message.createdAt).locale(locale).fromNow();

  return (
    <div
      data-contact-message
      data-is-last-message-of-group={isLast}
      data-is-first-message-of-group={isFirst}
      className={clsx(
        "flex items-end justify-start gap-2.5 sm:gap-5 ltr:mr-4 sm:ltr:mr-10 rtl:ml-4 sm:rtl:ml-10",
        isLast ? "mb-4" : "mb-1.5",
      )}
    >
      <div className="size-10 max-sm:hidden">
        {isLast && (
          <Avatar
            size={10}
            name={profile.name}
            src={profile.avatar}
            initialColor="auto"
          />
        )}
      </div>
      <Box
        className={clsx(
          isLast && !isFirst && "ltr:rounded-tl rtl:rounded-tr",
          isFirst && !isLast && "ltr:rounded-bl rtl:rounded-br",
          !isFirst && !isLast && "ltr:rounded-l rtl:rounded-r",
          "bg-gray-150 dark:bg-dark-700 max-w-lg rounded-2xl p-3",
        )}
      >
        <div>{message.content}</div>
        <p className="text-tiny-plus dark:text-dark-300 mt-1 -mb-1.5 text-end text-gray-400 ltr:mr-auto rtl:ml-auto">
          {formattedTime}
        </p>
      </Box>
    </div>
  );
}
