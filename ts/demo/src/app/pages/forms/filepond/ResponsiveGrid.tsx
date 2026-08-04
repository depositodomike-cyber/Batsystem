// Local Imports
import { FilePond } from "@/components/shared/form/Filepond";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";

// ----------------------------------------------------------------------

const ResponsiveGrid = () => {
  const { isMd, lgAndUp } = useBreakpointsContext();

  const gridSize = lgAndUp ? 3 : isMd ? 2 : 1;

  return (
    <div className="max-w-xl">
      <FilePond allowMultiple grid={gridSize} />
    </div>
  );
};

export { ResponsiveGrid };
