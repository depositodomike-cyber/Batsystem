// Import Dependencies
import { Description, Label, Radio, RadioGroup } from "@headlessui/react";
import clsx from "clsx";
import { forwardRef, SVGProps } from "react";

// ----------------------------------------------------------------------

// Define document type interface
interface DocumentType {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}

// Define component props
interface DocumentTypeProps {
  value: string;
  onChange: (value: string) => void;
  documentTypes: DocumentType[];
  name: string;
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx={12} cy={12} r={12} fill="#fff" opacity="0.2" />
      <path
        d="M7 13l3 3 7-7"
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


const DocumentType = forwardRef<HTMLElement, DocumentTypeProps>(
  ({ value, onChange, documentTypes, name }, ref) => {
    return (
      <RadioGroup
        ref={ref}
        value={documentTypes.find((doc) => doc.key === value) || undefined}
        onChange={(val: DocumentType) => onChange(val.key)}
        name={name}
      >
        <Label className="sr-only">Document Type</Label>
        <div className="mt-2 grid w-full gap-3 xl:grid-cols-3">
          {documentTypes.map((type) => (
            <Radio
              key={type.key}
              value={type}
              className={({ focus, checked }) =>
                clsx(
                  focus && "ring-primary-500/50 ring-2",
                  checked
                    ? "bg-primary-500 text-white"
                    : "bg-gray-150 dark:bg-dark-600",
                  "relative flex cursor-pointer rounded-lg px-3 py-4 outline-hidden transition-colors",
                )
              }
            >
              {({ checked }) => (
                <div className="flex w-full items-center justify-between space-x-2">
                  <div className="flex min-w-0 items-center space-x-3">
                    <type.icon className="size-5.5 shrink-0" />
                    <div className="min-w-0 text-sm">
                      <Label
                        as="p"
                        className={`truncate font-medium ${
                          checked
                            ? "text-white"
                            : "dark:text-dark-50 text-gray-900"
                        }`}
                      >
                        {type.label}
                      </Label>
                      <Description
                        as="div"
                        className={`mt-0.5 truncate text-xs ${
                          checked
                            ? "text-primary-100"
                            : "dark:text-dark-200 text-gray-500"
                        }`}
                      >
                        {type.description}
                      </Description>
                    </div>
                  </div>
                  {checked && (
                    <div className="shrink-0 text-white">
                      <CheckIcon className="size-6" />
                    </div>
                  )}
                </div>
              )}
            </Radio>
          ))}
        </div>
      </RadioGroup>
    );
  },
);

DocumentType.displayName = "DocumentType";

export { DocumentType };
