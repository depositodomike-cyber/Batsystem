// Import Dependencies
import { ReactNode } from "react";

// Local Imports
import { Table, THead, TBody, Th, Tr, Td } from "@/components/ui";

export interface ParamItem {
  name: string;
  type: string;
  default?: string | boolean;
  description: ReactNode;
}

export function Params({ params }: { params: ParamItem[] }) {
  return (
    <div className="mt-12">
      <h2 className="dark:text-dark-100 text-xl font-medium text-gray-800">
        Parameters
      </h2>

      <div className="hide-scrollbar min-w-full overflow-x-auto">
        <Table className="w-full min-w-[540px] text-left rtl:text-right">
          <THead>
            <Tr className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200">
              <Th className="dark:text-dark-100 px-0 font-semibold text-gray-800 uppercase">
                Parameter
              </Th>
              <Th className="dark:text-dark-100 font-semibold text-gray-800 uppercase">
                Default
              </Th>
              <Th className="dark:text-dark-100 px-0 font-semibold text-gray-800 uppercase">
                Description
              </Th>
            </Tr>
          </THead>
          <TBody>
            {params.map((tr, i) => (
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
                  <code className="dark:text-dark-100 text-gray-800 before:content-['`'] after:content-['`']">
                    {tr.default !== undefined && tr.default !== ""
                      ? typeof tr.default === "boolean"
                        ? tr.default.toString()
                        : tr.default
                      : "—"}
                  </code>
                </Td>
                <Td className="w-2/3 px-0 whitespace-normal">
                  <div className="inline-code">
                    <code className="before:content-['`'] after:content-['`']">
                      {tr.type}
                    </code>
                  </div>
                  <div className="mt-1 max-w-xl min-w-80 text-balance">
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
