// Import Dependencies
import { useState } from "react";
import type { FilePondFile } from "filepond";

// Local Imports
import { FilePond } from "@/components/shared/form/Filepond";

// ----------------------------------------------------------------------

const Basic = () => {
  const [state, setState] = useState<FilePondFile[]>([]);

  console.log(state);

  return (
    <div className="max-w-xl">
      <FilePond onupdatefiles={setState} />
    </div>
  );
};

export { Basic };
