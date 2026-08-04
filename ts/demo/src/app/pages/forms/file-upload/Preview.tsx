// Import Dependencies
import { useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import invariant from "tiny-invariant";

// Local Imports
import { Button, Upload } from "@/components/ui";
import { FileItemSquare } from "@/components/shared/form/FileItemSquare";

// ----------------------------------------------------------------------

const Preview = () => {
  const [file, setFile] = useState<File[]>();
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleRemove = (e: Event) => {
    invariant(uploadRef?.current, "Can't access to input file");
    e.stopPropagation();
    uploadRef.current.value = "";
    setFile([]);
  };

  return (
    <div>
      <Upload onChange={setFile} ref={uploadRef} accept="image/*">
        {({ ...props }) =>
          file && file.length > 0 ? (
            <FileItemSquare
              handleRemove={handleRemove}
              file={file[0]}
              {...props}
            />
          ) : (
            <Button
              unstyled
              className="hover:text-primary-600 dark:text-dark-450 dark:hover:text-primary-500 size-20 shrink-0 space-x-2 rounded-lg border-2 border-current p-0 text-gray-300"
              {...props}
            >
              <PlusIcon className="size-6 stroke-2" />
            </Button>
          )
        }
      </Upload>
    </div>
  );
};

export { Preview };
