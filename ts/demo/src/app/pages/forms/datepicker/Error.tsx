import { DatePicker } from "@/components/shared/form/Datepicker";

const now = new Date();

const Error = () => {
  return (
    <div className="max-w-xl">
      <DatePicker
        label="Enter Date:"
        defaultValue={now}
        placeholder="Choose date..."
        error="Something went wrong"
      />
    </div>
  );
};

export { Error };
