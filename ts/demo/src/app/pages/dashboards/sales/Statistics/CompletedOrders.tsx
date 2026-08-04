// Local Imports
import { Card, Circlebar } from "@/components/ui";

// ----------------------------------------------------------------------

export function CompletedOrders() {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Circlebar size={12} value={45} color="primary" strokeWidth={10}>
        <div className="flex items-center justify-center text-xs">45%</div>
      </Circlebar>
      <div className="text-xs-plus dark:text-dark-100 font-medium [word-break:break-word] text-gray-700">
        Closed Orders
      </div>
    </Card>
  );
}
