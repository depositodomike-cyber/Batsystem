// Import Dependencies
import { useState } from "react";

// Local Imports
import { Listbox } from "@/components/shared/form/StyledListbox";

// ----------------------------------------------------------------------

interface Person {
  id: number;
  name: string;
}

const people: Person[] = [
  { id: 1, name: "Durward Reynolds" },
  { id: 2, name: "Kenton Towne" },
  { id: 3, name: "Therese Wunsch" },
  { id: 4, name: "Benedict Kessler" },
  { id: 5, name: "Katelyn Rohan" },
];

const Styled = () => {
  const [selected, setSelected] = useState<Person | null>(null);

  return (
    <div className="max-w-xl">
      <Listbox
        data={people}
        value={selected}
        placeholder="Select People"
        onChange={setSelected}
        label="People"
        displayField="name"
      />
    </div>
  );
};

export { Styled };
