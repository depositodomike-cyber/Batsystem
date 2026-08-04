// Local Imports
import { TransactionCard } from "./TransactionCard";

// ----------------------------------------------------------------------

const payments = [
  {
    uid: "1",
    name: "Konnor Guzman",
    avatar: "/images/avatar/avatar-20.jpg",
    time: "Dec 21, 2021 - 08:05",
    amount: 660.22,
  },
  {
    uid: "2",
    name: "Henry Curtis",
    avatar: "/images/avatar/avatar-18.jpg",
    time: "Dec 19, 2021 - 11:55",
    amount: 33.63,
  },
  {
    uid: "3",
    name: "Derrick Simmons",
    avatar: null,
    time: "Dec 16, 2021 - 14:45",
    amount: -674.63,
  },
  {
    uid: "4",
    name: "Kartina West",
    avatar: "/images/avatar/avatar-5.jpg",
    time: "Dec 13, 2021 - 11:30",
    amount: 547.63,
  },
  {
    uid: "5",
    name: "Samantha Shelton",
    avatar: "/images/avatar/avatar-11.jpg",
    time: "Dec 10, 2021 - 09:41",
    amount: 736.24,
  },
  {
    uid: "6",
    name: "Joe Perkins",
    avatar: null,
    time: "Dec 06, 2021 - 11:41",
    amount: -369.6,
  },
  {
    uid: "7",
    name: "John Parker",
    avatar: "/images/avatar/avatar-2.jpg",
    time: "Dec 09, 2021 - 23:20",
    amount: 231.0,
  },
];

export function Transactions() {
  return (
    <div className="col-span-12 flex flex-col sm:col-span-6 lg:col-span-4">
      <div className="flex min-w-0 items-center justify-between">
        <h2 className="font-medium tracking-wide text-gray-800 dark:text-dark-100">
          Transactions
        </h2>
        <a
          href="##"
          className="border-b border-dotted border-current pb-0.5 text-xs-plus font-medium text-primary-600 outline-hidden transition-colors duration-300 hover:text-primary-600/70 focus:text-primary-600/70 dark:text-primary-400 dark:hover:text-primary-400/70 dark:focus:text-primary-400/70"
        >
          View All
        </a>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-between space-y-4">
        {payments.map((payment) => (
          <TransactionCard key={payment.uid} {...payment} />
        ))}
      </div>
    </div>
  );
}
