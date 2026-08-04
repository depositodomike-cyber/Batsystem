// Import Dependencies
import TextareaAutosize from "react-textarea-autosize";

// Local Imports
import { Textarea } from "@/components/ui";

// ----------------------------------------------------------------------

export function TitleField({
  register,
  error,
  listName,
}: {
  register: any;
  error: React.ReactNode;
  listName: string;
}) {
  return (
    <Textarea
      {...register("title")}
      error={error}
      placeholder="Task Title"
      classNames={{
        root: "-mx-1 -mt-0.5 flex-1",
        error: "px-1",
        input:
          "rounded-sm border-dashed px-1 py-0.5 text-lg [&:not(:hover):not(:focus)]:border-transparent",
      }}
      component={TextareaAutosize}
      maxRows={4}
      rows={1}
      description={
        <div className="-mt-1 px-1">
          in list <span className="font-semibold">{listName}</span>
        </div>
      }
    />
  );
}
