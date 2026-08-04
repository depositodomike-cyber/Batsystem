// Import Dependencies
import { ReactNode } from "react";

// Local Imports
import { Table, THead, TBody, Th, Tr, Td } from "@/components/ui";

export interface ReturnItem {
  name: string;
  type: string;
  description: ReactNode;
}

export function Returns({ returns }: { returns: ReturnItem[] }) {
  return (
    <div className="mt-12">
      <h2 className="dark:text-dark-100 text-xl font-medium text-gray-800">
        Returns
      </h2>

      <div className="hide-scrollbar min-w-full overflow-x-auto">
        <Table className="w-full min-w-[540px] text-left rtl:text-right">
          <THead>
            <Tr className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200">
              <Th className="dark:text-dark-100 px-0 font-semibold text-gray-800 uppercase">
                Return
              </Th>
              <Th className="dark:text-dark-100 font-semibold text-gray-800 uppercase">
                Type
              </Th>
              <Th className="dark:text-dark-100 px-0 font-semibold text-gray-800 uppercase">
                Description
              </Th>
            </Tr>
          </THead>
          <TBody>
            {returns.map((tr, i) => (
              <Tr
                key={i}
                className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200"
              >
                <Td className="w-2/12 shrink-0 px-0">
                  <code className="dark:text-dark-100 text-gray-800 before:content-['`'] after:content-['`']">
                    {tr.name}
                  </code>
                </Td>
                <Td className="w-2/12 shrink-0">
                  <div className="inline-code">
                    <code className="before:content-['`'] after:content-['`']">
                      {tr.type}
                    </code>
                  </div>
                </Td>
                <Td className="w-2/3 px-0 whitespace-normal">
                  <div className="max-w-xl min-w-80 text-balance">
                    {tr.description}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
