import { useRef } from "react";
import { DatePicker } from "@/components/shared/form/Datepicker";
import { type FlatpickrRef } from "@/components/shared/form/Flatpickr";
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

const Instance = () => {
  const ref = useRef<FlatpickrRef>(null);

  return (
    <div className="max-w-xl">
      <DatePicker ref={ref} placeholder="Choose date..." />

      <Button className="mt-4" onClick={() => ref.current?._flatpickr?.open()}>
        Open
      </Button>
    </div>
  );
};

export { Instance };
