// Import Dependencies
import { Row } from "@tanstack/react-table";

// Local Imports
import { Table, Tag, THead, TBody, Th, Tr, Td } from "@/components/ui";
import { Order } from "./data";

// ----------------------------------------------------------------------

const cols = ["Name", "SKU", "Price", "Quantity", "Discount", "Total"];

export function SubRowComponent({
  row,
  cardWidth,
}: {
  row: Row<Order>;
  cardWidth?: number;
}) {
  return (
    <div
      className="dark:border-b-dark-500 dark:bg-dark-750 sticky border-b border-b-gray-200 bg-gray-50 pt-3 pb-4 ltr:left-0 rtl:right-0"
      style={{ maxWidth: cardWidth }}
    >
      <p className="dark:text-dark-100 mt-1 px-4 font-medium text-gray-800 sm:px-5 lg:ltr:ml-14 rtl:rtl:mr-14">
        Customer orders:
      </p>

      <div className="mt-1 overflow-x-auto overscroll-x-contain px-4 sm:px-5 lg:ltr:ml-14 rtl:rtl:mr-14">
        <Table
          hoverable
          className="text-xs-plus w-full text-left rtl:text-right [&_.table-td]:py-2"
        >
          <THead>
            <Tr className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200">
              {cols.map((title, index) => (
                <Th
                  key={index}
                  className="dark:text-dark-100 py-2 font-semibold text-gray-800 uppercase first:px-0 last:px-0"
                >
                  {title}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {row.original.products.map((tr) => (
              <Tr
                key={tr.sku}
                className="dark:border-b-dark-500 border-y border-transparent border-b-gray-200"
              >
                <Td className="px-0 font-medium ltr:rounded-l-lg rtl:rounded-r-lg">
                  <div className="flex items-center space-x-2">
                    <div className="size-8">
                      <img
                        src={tr.image}
                        alt={tr.name}
                        className="h-full w-full rounded-sm object-cover object-center"
                      />
                    </div>
                    <span>{tr.name}</span>
                  </div>
                </Td>
                <Td>{tr.sku}</Td>
                <Td>{tr.price}</Td>
                <Td>{tr.qty}</Td>
                <Td>{tr.discount}</Td>
                <Td className="dark:text-dark-100 px-0 font-medium text-gray-800 ltr:rounded-r-lg rtl:rounded-l-lg">
                  {tr.total}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="flex justify-end px-4 sm:px-5">
        <div className="mt-4 w-full max-w-xs text-end">
          <Table className="w-full [&_.table-td]:px-0 [&_.table-td]:py-1">
            <TBody>
              <Tr>
                <Td>Summary :</Td>
                <Td>
                  <span className="dark:text-dark-100 font-medium text-gray-800">
                    ${row.original.subtotal}
                  </span>
                </Td>
              </Tr>
              <Tr>
                <Td>Delivery fee :</Td>
                <Td>
                  <span className="dark:text-dark-100 font-medium text-gray-800">
                    ${row.original.delivery_fee}
                  </span>
                </Td>
              </Tr>
              <Tr>
                <Td>Tax :</Td>
                <Td>
                  <span className="dark:text-dark-100 font-medium text-gray-800">
                    ${row.original.tax}
                  </span>
                </Td>
              </Tr>
              <Tr className="text-primary-600 dark:text-primary-400 text-lg">
                <Td>Total :</Td>
                <Td>
                  <span className="font-medium">
                    ${row.original.total_amount_due}
                  </span>
                </Td>
              </Tr>
            </TBody>
          </Table>
          <div className="mt-2 flex justify-end space-x-1.5">
            <Tag component="button" className="min-w-[4rem]">
              Invoice
            </Tag>
            <Tag component="button" color="primary" className="min-w-[4rem]">
              View
            </Tag>
          </div>
        </div>
      </div>
    </div>
  );
}
