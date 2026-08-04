// Local Imports
import { Table, THead, TBody, Th, Tr, Td } from "@/components/ui";

// ----------------------------------------------------------------------

interface Item {
  uid: string;
  title: string;
  desc: string;
  hrs: string;
  rate: string;
  subtotal: string;
}

const data: Item[] = [
  {
    uid: "1",
    title: "Template Design",
    desc: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Perferendis",
    hrs: "10hr",
    rate: "$55",
    subtotal: "$550",
  },
  {
    uid: "2",
    title: "Mobile App",
    desc: "Lorem ipsum dolor sit amet, consectetur adipisicing elit.",
    hrs: "8hr",
    rate: "$40",
    subtotal: "$320",
  },
  {
    uid: "3",
    title: "UI/UX Design",
    desc: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Animi",
    hrs: "25hr",
    rate: "$15",
    subtotal: "$375",
  },
  {
    uid: "4",
    title: "CRM App",
    desc: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Distinctio et ipsa modi.",
    hrs: "80hr",
    rate: "$65",
    subtotal: "$5200",
  },
  {
    uid: "5",
    title: "CMS App",
    desc: "Lorem ipsum dolor sit amet, consectetur.",
    hrs: "25hr",
    rate: "$35",
    subtotal: "$875",
  },
];

export function ItemsTable() {
  return (
    <div className="hide-scrollbar min-w-full overflow-x-auto">
      <Table zebra className="w-full text-left rtl:text-right">
        <THead>
          <Tr>
            <Th className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg">
              #
            </Th>
            <Th className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg">
              DESCRIPTION
            </Th>
            <Th className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 text-end font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg">
              HRS
            </Th>
            <Th className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 text-end font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg">
              RATE
            </Th>
            <Th className="dark:bg-dark-800 dark:text-dark-100 bg-gray-200 text-end font-semibold text-gray-800 uppercase first:ltr:rounded-l-lg last:ltr:rounded-r-lg first:rtl:rounded-r-lg last:rtl:rounded-l-lg">
              SUBTOTAL
            </Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((tr) => (
            <Tr key={tr.uid}>
              <Td className="ltr:rounded-l-lg rtl:rounded-r-lg">{tr.uid}</Td>
              <Td className="whitespace-normal">
                <div className="min-w-[16rem]">
                  <p className="dark:text-dark-100 truncate font-medium text-gray-800">
                    {tr.title}
                  </p>
                  <p className="text-xs-plus line-clamp-2">{tr.desc}</p>
                </div>
              </Td>
              <Td className="text-end">{tr.hrs}</Td>
              <Td className="text-end">{tr.rate}</Td>
              <Td className="text-end font-semibold ltr:rounded-r-lg rtl:rounded-l-lg">
                {tr.subtotal}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
