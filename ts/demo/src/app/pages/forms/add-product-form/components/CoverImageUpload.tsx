// Import Dependencies
import { CloudArrowUpIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import {
  forwardRef,
  useCallback,
  type ForwardedRef,
  type ReactNode,
} from "react";
import { useDropzone } from "react-dropzone";

// Local Imports
import { PreviewImg } from "@/components/shared/PreviewImg";
import { Button, InputErrorMsg } from "@/components/ui";
import { useId } from "@/hooks";

// ----------------------------------------------------------------------

interface CoverImageUploadProps {
  classNames?: {
    label?: string;
    box?: string;
    error?: string;
  };
  value: File | null;
  label?: ReactNode;
  onChange: (file: File | null) => void;
  error?: string | boolean;
}

const CoverImageUpload = forwardRef<HTMLButtonElement, CoverImageUploadProps>(
  (
    { classNames, value, label, onChange, error },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    const id = useId();

    const { getRootProps, getInputProps, isDragReject, isDragAccept } =
      useDropzone({
        onDrop: useCallback((acceptedFiles: File[]) => {
          const file = acceptedFiles[0];
          if (file) {
            onChange(file);
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
        accept: {
          "image/png": [".png"],
          "image/jpeg": [".jpeg"],
          "image/jpg": [".jpg"],
        },
        multiple: false,
      });

    const onRemove = () => {
      onChange(null);
    };

    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={id} className={classNames?.label}>
            {label}
          </label>
        )}
        <div
          className={clsx(
            "h-72 w-full rounded-lg border-2 border-dashed border-current",
            !isDragAccept &&
              (isDragReject || error) &&
              "text-error dark:text-error-light",
            isDragAccept && "text-primary-600 dark:text-primary-500",
            !isDragReject &&
              !isDragAccept &&
              !error &&
              "dark:text-dark-450 text-gray-300",
            classNames?.box,
          )}
        >
          {value ? (
            <div
              title={value.name}
              className="group ring-primary-600 dark:ring-primary-500 dark:ring-offset-dark-700 relative h-full w-full rounded-lg ring-offset-4 ring-offset-white transition-all hover:ring-3"
            >
              <div className="h-full w-full overflow-hidden p-2">
                <PreviewImg
                  className="m-auto h-full object-contain"
                  file={value}
                  alt={value.name}
                />
              </div>

              <div className="dark:bg-dark-700 absolute -top-4 -right-3 flex items-center justify-center rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  onClick={onRemove}
                  className="dark:border-dark-450 size-6 shrink-0 rounded-full border p-0"
                >
                  <XMarkIcon className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              {...getRootProps()}
              color={undefined}
              unstyled
              className="h-full w-full shrink-0 flex-col gap-2 px-3"
              ref={ref}
            >
              <CloudArrowUpIcon className="pointer-events-none size-12" />
              <span className="dark:text-dark-200 pointer-events-none mt-2 text-gray-600">
                <span className="text-primary-600 dark:text-primary-400">
                  Browse
                </span>
                <span> or drop your files here</span>
              </span>
            </Button>
          )}
          <input type="file" {...{ ...getInputProps(), id }} />
        </div>
        <InputErrorMsg
          when={!!error && typeof error !== "boolean"}
          className={classNames?.error}
        >
          {error}
        </InputErrorMsg>
      </div>
    );
  },
);

CoverImageUpload.displayName = "CoverImageUpload";

export { CoverImageUpload };
