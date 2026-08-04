import { DatePicker } from "@/components/shared/form/Datepicker";

const now = new Date();

const Basic = () => {
  return (
    <div className="max-w-xl">
      <DatePicker
        label="Enter Date"
        defaultValue={now}
        placeholder="Choose date..."
      />
    </div>
  );
};

export { Basic };
