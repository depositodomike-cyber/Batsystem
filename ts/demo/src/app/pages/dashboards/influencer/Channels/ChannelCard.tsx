// Local Imports
import { Box } from "@/components/ui";

// ----------------------------------------------------------------------

export interface Channel {
  id: string;
  logo: string;
  name: string;
  username: string;
  impression: string;
}

export function ChannelCard({ logo, name, username, impression }: Channel) {
  return (
    <Box className="flex w-36 shrink-0 flex-col items-center">
      <img className="z-10 size-10" src={logo} alt={name} />
      <Box className="shadow-soft dark:bg-dark-700 -mt-5 flex w-full flex-col rounded-2xl bg-white px-3 py-5 text-center dark:shadow-none">
        <p className="dark:text-dark-100 mt-3 text-base font-medium text-gray-800">
          {name}
        </p>
        <a
          href="##"
          className="text-xs-plus hover:text-primary-600 focus:text-primary-600 dark:text-dark-300 dark:hover:text-primary-400 dark:focus:text-primary-400 mt-1 tracking-wide text-gray-400"
        >
          {username}
        </a>
        <div className="dark:text-dark-100 mt-6 flex justify-center gap-1 text-gray-800">
          <p className="text-4xl font-medium">{impression}</p>
          <p className="mt-1 font-medium">%</p>
        </div>
      </Box>
    </Box>
  );
}
