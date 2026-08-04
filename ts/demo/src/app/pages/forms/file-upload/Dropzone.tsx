// Import Dependencies
import { useDropzone } from "react-dropzone";
import { CloudArrowUpIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

// Local Imports
import { useListState } from "@/hooks";
import { Button } from "@/components/ui";
import { FileItem } from "@/components/shared/form/FileItem";

// ----------------------------------------------------------------------

const Dropzone = () => {
  const [files, { remove, append }] = useListState<File>();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => append(...files),
    accept: { "image/png": [".png", ".jpeg", ".jpg"] },
  });

  return (
    <div>
      <p className="dark:text-dark-100 font-medium text-gray-800">
        Upload Files
      </p>
      <p className="mt-1 text-xs">
        You can upload .png, .jpg and .jpeg file formats.
      </p>
      <Button
        {...getRootProps()}
        unstyled
        color={undefined}
        className={clsx(
          "mt-3 w-full shrink-0 flex-col rounded-lg border-2 border-dashed py-10",
          isDragActive
            ? "border-primary-600 dark:border-primary-500"
            : "dark:border-dark-450 border-gray-300",
        )}
      >
        <CloudArrowUpIcon className="size-12" />
        <span
          className={clsx(
            "pointer-events-none mt-2",
            isDragActive
              ? "text-primary-600 dark:text-primary-400"
              : "dark:text-dark-200 text-gray-600",
          )}
        >
          <span className="text-primary-600 dark:text-primary-400">Browse</span>
          <span> or drop your files here</span>
        </span>
      </Button>

      <input hidden type="file" {...getInputProps()} />

      <div className="mt-4 flex flex-col space-y-4">
        {files.map((file, index) => (
          <FileItem
            handleRemove={() => remove(index)}
            file={file}
            key={index}
          />
        ))}
      </div>
    </div>
  );
};

export { Dropzone };
