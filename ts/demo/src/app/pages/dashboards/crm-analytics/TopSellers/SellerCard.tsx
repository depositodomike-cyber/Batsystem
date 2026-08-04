// Import Dependencies
import {
  ChatBubbleOvalLeftEllipsisIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Button, Card } from "@/components/ui";

// ----------------------------------------------------------------------

interface Award {
  uid: string;
  label: string;
  image: string;
}

interface Relations {
  calls: number;
  chatMessages: number;
  emails: number;
}

export interface Seller {
  uid: string;
  name: string;
  avatar?: string;
  messages?: number | null;
  mails?: number | null;
  sells: number;
  target: number;
  clients: number;
  relations: Relations;
  awards: Award[];
}

export function SellerCard({
  name,
  avatar,
  messages,
  mails,
  sells,
  target,
  clients,
  relations,
  awards,
}: Seller) {
  return (
    <Card skin="shadow" className="w-72 shrink-0 space-y-9 p-4 sm:p-5">
      <div className="flex justify-between gap-2">
        <div className="flex items-center gap-3">
          <Avatar
            size={10}
            name={name}
            src={avatar}
            classNames={{ display: "mask is-squircle rounded-none" }}
            initialColor="auto"
          />

          <div>
            <p className="dark:text-dark-100 font-medium text-gray-800">
              {name}
            </p>
            <p className="dark:text-dark-300 text-xs text-gray-400">Employee</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button className="size-7" color="primary" variant="soft" isIcon>
              <ChatBubbleOvalLeftEllipsisIcon className="size-4" />
            </Button>
            {messages && (
              <div className="bg-primary-600 text-tiny dark:bg-primary-500 pointer-events-none absolute top-0 right-0 -m-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 leading-none font-medium text-white">
                {messages}
              </div>
            )}
          </div>
          <div className="relative">
            <Button className="size-7" color="primary" variant="soft" isIcon>
              <EnvelopeIcon className="size-4" />
            </Button>
            {mails && (
              <div className="bg-primary-600 text-tiny dark:bg-primary-500 pointer-events-none absolute top-0 right-0 -m-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 leading-none font-medium text-white">
                {mails}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <div>
          <p className="text-xs-plus">Sells</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {sells}
          </p>
        </div>
        <div>
          <p className="text-xs-plus">Target</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {target}
          </p>
        </div>
        <div>
          <p className="text-xs-plus">Clients</p>
          <p className="dark:text-dark-100 text-xl font-semibold text-gray-800">
            {clients}
          </p>
        </div>
      </div>

      <div className="grow">
        <div className="flex w-full gap-1">
          {relations?.calls && (
            <div
              className="this:primary bg-this dark:bg-this-light h-2 rounded-full"
              style={{
                width: `${relations.calls * 100}%`,
              }}
            />
          )}
          {relations?.chatMessages && (
            <div
              className="this:success bg-this dark:bg-this-light h-2 rounded-full"
              style={{
                width: `${relations.chatMessages * 100}%`,
              }}
            />
          )}
          {relations?.emails && (
            <div
              className="this:info bg-this dark:bg-this-light h-2 rounded-full"
              style={{
                width: `${relations.emails * 100}%`,
              }}
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {relations?.calls && (
            <div className="inline-flex items-center gap-x-2">
              <div className="this:primary bg-this dark:bg-this-light size-2 rounded-full" />
              <div className="flex space-x-1 text-xs leading-none">
                <span className="dark:text-dark-100 font-medium text-gray-800">
                  Calls
                </span>
                <span>{(relations.calls * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
          {relations?.chatMessages && (
            <div className="inline-flex items-center gap-x-2">
              <div className="this:success bg-this dark:bg-this-light size-2 rounded-full" />
              <div className="flex space-x-1 text-xs leading-none">
                <span className="dark:text-dark-100 font-medium text-gray-800">
                  Chat Messages
                </span>
                <span>{(relations.chatMessages * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
          {relations?.emails && (
            <div className="inline-flex items-center gap-x-2">
              <div className="this:info bg-this dark:bg-this-light size-2 rounded-full" />
              <div className="flex space-x-1 text-xs leading-none">
                <span className="dark:text-dark-100 font-medium text-gray-800">
                  Emails
                </span>
                <span>{(relations?.emails * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <div className="flex gap-2">
          {awards.map((award) => (
            <img
              key={award.uid}
              data-tooltip
              data-tooltip-content={award.label}
              className="size-6"
              src={award.image}
              alt={award.label}
            />
          ))}
        </div>
        <Button
          variant="flat"
          isIcon
          className="size-8 rounded-full ltr:-mr-1.5 rtl:-ml-1.5"
        >
          <Cog6ToothIcon className="size-5" />
        </Button>
      </div>
    </Card>
  );
}
