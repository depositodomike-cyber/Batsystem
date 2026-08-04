// Local Imports
import { Table, THead, TBody, Th, Tr, Td } from "@/components/ui";

// ----------------------------------------------------------------------

const cols = ["#", "Name", "Job", "FAVORITE COLOR"];

interface Data {
  uid: string;
  name: string;
  job: string;
  favColor: string;
}

const data: Data[] = [
  {
    uid: "1",
    name: "Cy Ganderton",
    job: "Quality Control Specialist",
    favColor: "Blue",
  },
  {
    uid: "2",
    name: "Hart Hagerty",
    job: "Desktop Support Technician",
    favColor: "Purple",
  },
  {
    uid: "3",
    name: "Brice Swyre",
    job: "Tax Accountant",
    favColor: "Red",
  },
  {
    uid: "4",
    name: "Marjy Ferencz",
    job: "Office Assistant I",
    favColor: "Crimson",
  },
];

export function Basic() {
  return (
    <div className="hide-scrollbar min-w-full overflow-x-auto">
      <Table className="w-full text-left rtl:text-right">
        <THead>
          <Tr className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200">
            {cols.map((title, index) => (
              <Th
                key={index}
                className="dark:text-dark-100 font-semibold text-gray-800 uppercase"
              >
                {title}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {data.map((tr) => (
            <Tr
              key={tr.uid}
              className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200"
            >
              <Td>{tr.uid}</Td>
              <Td>{tr.name}</Td>
              <Td>{tr.job}</Td>
              <Td>{tr.favColor}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
