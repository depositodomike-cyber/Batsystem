// Import Dependencies
import clsx from "clsx";
import { toast } from "sonner";
import { FaInfo, FaTrashAlt } from "react-icons/fa";
import { useState } from "react";

// Local Imports
import { StyledSwitch } from "@/components/shared/form/StyledSwitch";
import { Button, GhostSpinner } from "@/components/ui";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useListState } from "@/hooks";

// ----------------------------------------------------------------------

interface App {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface InstalledAppProps extends App {
  enabled: boolean;
  onChangeStatus: (id: string, value: boolean) => void;
  onUninstall: (id: string) => void;
}

interface NotInstalledAppProps extends App {
  onInstall: (id: string) => void;
}

const apps: App[] = [
  {
    id: "slack",
    name: "Slack",
    icon: "slack.svg",
    description: "Connect your Slack account",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "github.svg",
    description: "Access to your GitHub account",
  },
  {
    id: "jira",
    name: "Jira",
    icon: "jira.svg",
    description: "Access to your Jira account",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: "google-drive.svg",
    description: "Access to your files on Google Drive",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "discord-round.svg",
    description: "Connect your Discord account",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "google-calendar.svg",
    description: "Access to your events on Google Calendar",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: "hubspot.svg",
    description: "Access to your HubSpot account",
  },
  {
    id: "dribbble",
    name: "Dribbble",
    icon: "dribbble-round.svg",
    description: "Access to your Dribbble account",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "dropbox-round.svg",
    description: "Connect your Dropbox account",
  },
  {
    id: "figma",
    name: "Figma",
    icon: "figma-round.svg",
    description: "Access to your Figma account",
  },
  {
    id: "twitter",
    name: "Twitter",
    icon: "twitter-round.svg",
    description: "Access to your Twitter account",
  },
  {
    id: "trello",
    name: "Trello",
    icon: "trello.svg",
    description: "Access to your Trello account",
  },
  {
    id: "notion",
    name: "Notion",
    icon: "notion.svg",
    description: "Access to your Notion account",
  },
];

export default function Applications() {
  const [installedAppsList, installedAppsHandlers] = useListState([
    {
      id: "slack",
      enabled: true,
    },
    {
      id: "github",
      enabled: true,
    },
    {
      id: "jira",
      enabled: false,
    },
    {
      id: "google-drive",
      enabled: true,
    },
  ]);

  const installedApps = apps
    .filter((app) =>
      installedAppsList.some((installedApp) => installedApp.id === app.id),
    )
    .map((app) => ({
      ...app,
      enabled:
        installedAppsList.find((installedApp) => installedApp.id === app.id)
          ?.enabled ?? false,
    }));

  const restApps = apps.filter(
    (app) =>
      !installedAppsList.some((installedApp) => installedApp.id === app.id),
  );

  const updateAppStatusHandler = (id: string, value: boolean) => {
    installedAppsHandlers.applyWhere(
      (app) => app.id === id,
      (app) => ({ ...app, enabled: value }),
    );
  };

  const installAppHandler = (id: string) => {
    installedAppsHandlers.append({
      id,
      enabled: true,
    });
  };

  const uninstallAppHandler = (id: string) => {
    installedAppsHandlers.filter((app) => app.id !== id);
  };

  return (
    <div className="w-full max-w-5xl">
      <h5 className="dark:text-dark-50 text-lg font-medium text-gray-800">
        Applications
      </h5>
      <p className="dark:text-dark-200 mt-0.5 text-sm text-balance text-gray-500">
        Manage Connected Applications
      </p>
      <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />
      <div>
        <p className="dark:text-dark-100 text-base font-medium text-gray-800">
          Installed Applications
        </p>
        <p className="mt-0.5">List of all installed applications</p>
        <div className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {installedApps.map((app) => (
              <InstalledApp
                key={app.id}
                {...app}
                onUninstall={uninstallAppHandler}
                onChangeStatus={updateAppStatusHandler}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />
      <div>
        <p className="dark:text-dark-100 text-base font-medium text-gray-800">
          Additional Applications
        </p>
        <p className="mt-0.5">
          List of additional applications you can add to your account
        </p>
        <div className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {restApps.map((app) => (
              <NotInstalledApp
                key={app.id}
                {...app}
                onInstall={installAppHandler}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstalledApp({
  id,
  name,
  icon,
  description,
  enabled,
  onChangeStatus,
  onUninstall,
}: InstalledAppProps) {
  const [loadingUninstall, setLoadingUninstall] = useState(false);
  const [loadingChangeStatus, setLoadingChangeStatus] = useState(false);
  const { cardSkin } = useThemeContext();

  const handleUninstall = () => {
    setLoadingUninstall(true);
    setTimeout(() => {
      onUninstall(id);
      toast.success(`${name} has been uninstalled`);
      setLoadingUninstall(false);
    }, 2000);
  };

  const handleChangeStatus = (val: boolean) => {
    setLoadingChangeStatus(true);
    setTimeout(() => {
      onChangeStatus(id, val);
      toast.success(`${name} status has been changed`);
      setLoadingChangeStatus(false);
    }, 2000);
  };

  return (
    <div
      className={clsx(
        "flex flex-col rounded-lg bg-gray-100 p-3",
        cardSkin === "shadow" ? "dark:bg-dark-900" : "dark:bg-dark-700",
      )}
    >
      <div className="flex items-center gap-2">
        <img className="size-8" src={`/images/logos/${icon}`} alt={name} />
        <p className="dark:text-dark-100 text-base font-medium text-gray-800">
          {name}
        </p>
      </div>
      <p className="mt-2 grow">{description}</p>

      <div className="mt-6 flex items-end justify-between gap-2">
        <div className="flex justify-between gap-2">
          <Button
            data-tooltip
            data-tooltip-content={description}
            isIcon
            className="size-7 rounded-full"
          >
            <FaInfo className="size-3.5" />
          </Button>
          <Button
            onClick={handleUninstall}
            isIcon
            color="error"
            className="size-7 rounded-full"
          >
            {loadingUninstall ? (
              <GhostSpinner className="size-3.5 border-2" />
            ) : (
              <FaTrashAlt className="size-3.5" />
            )}
          </Button>
        </div>
        <StyledSwitch
          checked={enabled}
          onChange={handleChangeStatus}
          loading={loadingChangeStatus}
        />
      </div>
    </div>
  );
}

function NotInstalledApp({
  id,
  name,
  icon,
  description,
  onInstall,
}: NotInstalledAppProps) {
  const [loading, setLoading] = useState(false);

  const handleInstall = () => {
    setLoading(true);
    setTimeout(() => {
      onInstall(id);
      toast.success(`${name} has been installed`);
      setLoading(false);
    }, 2000);
  };
  return (
    <div className="dark:border-dark-500 flex flex-col rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <img className="size-8" src={`/images/logos/${icon}`} alt={name} />
        <p className="dark:text-dark-100 text-base font-medium text-gray-800">
          {name}
        </p>
      </div>
      <p className="mt-2 grow">{description}</p>

      <div className="mt-6 flex justify-between">
        <Button
          data-tooltip
          data-tooltip-content={description}
          isIcon
          className="size-7 rounded-full"
        >
          <FaInfo className="size-3.5" />
        </Button>
        <Button
          color="primary"
          className="text-xs-plus h-8 gap-2 rounded-md uppercase"
          onClick={handleInstall}
        >
          {loading && <GhostSpinner className="size-3.5 border-2" />}
          <span> {loading ? "Installing..." : "Install"}</span>
        </Button>
      </div>
    </div>
  );
}

