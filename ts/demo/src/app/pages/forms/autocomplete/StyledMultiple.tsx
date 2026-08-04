// Import Dependencies
import { useState, KeyboardEvent } from "react";

// Local Imports
import { Combobox } from "@/components/shared/form/StyledCombobox";

// ----------------------------------------------------------------------

type Person = {
  id: number;
  name: string;
};

const people: Person[] = [
  { id: 1, name: "Wade Cooper" },
  { id: 2, name: "Arlene Mccoy" },
  { id: 3, name: "Devon Webb" },
  { id: 4, name: "Tom Cook" },
  { id: 5, name: "Tanya Fox" },
  { id: 6, name: "Hellen Schmidt" },
];

export function StyledMultiple() {
  const [selected, setSelected] = useState<Person[]>([]);

  return (
    <div className="max-w-xl">
      <Combobox
        data={people}
        displayField="name"
        value={selected}
        onChange={setSelected}
        placeholder="Please Select User"
        label="Select User"
        searchFields={["name"]}
        multiple
        // Remove Item on Backspace
        inputProps={{
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            if (
              selected.length > 0 &&
              event.key === "Backspace" &&
              (event.target as HTMLInputElement).value === ""
            ) {
              setSelected((current) => current.slice(0, -1));
            }
          },
        }}
      />
    </div>
  );
}
