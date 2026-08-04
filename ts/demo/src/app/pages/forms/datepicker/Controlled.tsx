// Import Dependencies
import { useState } from "react";

// Local Imports
import { DatePicker } from "@/components/shared/form/Datepicker";
import { Button } from "@/components/ui";
import { type DateOption } from "@/components/shared/form/Flatpickr";

// ----------------------------------------------------------------------

const Controlled = () => {
  const [date, setDate] = useState<DateOption | DateOption[] | "">("");

  return (
    <div className="max-w-xl">
      <DatePicker
        options={{
          dateFormat: "d/m/Y",
        }}
        value={date}
        onChange={(date) => setDate(date)}
        placeholder="Choose date..."
      />

      <Button className="mt-4" onClick={() => setDate(new Date())}>
        Set Today
      </Button>
    </div>
  );
};

export { Controlled };
