// Import Dependencies
import { useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button, Upload } from "@/components/ui";
import { PreviewImg } from "@/components/shared/PreviewImg";

// ----------------------------------------------------------------------

export const Basic = () => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div>
      <PreviewImg
        className="size-16 rounded-lg"
        src="/images/avatar/avatar-20.jpg"
        file={file}
      />

      <div className="mt-4">
        <Upload onChange={(file) => setFile(file[0])} accept="image/*">
          {({ ...props }) => (
            <Button {...props} className="space-x-2">
              <ArrowUpTrayIcon className="size-5" />
              <span>Choose File</span>
            </Button>
          )}
        </Upload>
      </div>
    </div>
  );
};
