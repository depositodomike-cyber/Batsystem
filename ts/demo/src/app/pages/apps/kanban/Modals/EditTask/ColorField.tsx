// Import Dependencies
import { Label, Radio, RadioGroup } from "@headlessui/react";
import clsx from "clsx";
import { ControllerRenderProps } from "react-hook-form";
import { Fragment } from "react";

// Local Imports
import { Button } from "@/components/ui";
import { colors } from "../../data";

// ----------------------------------------------------------------------

export function ColorField(props: ControllerRenderProps) {
  return (
    <RadioGroup {...props}>
      <Label>Task Color:</Label>
      <div className="mt-2 flex gap-2 lg:mt-3.5">
        {colors.map((color) => (
          <Radio as={Fragment} key={color} value={color}>
            {({ checked }) => (
              <Button
                isIcon
                color={color}
                className={clsx(
                  "ring-this dark:ring-offset-dark-700 size-5 rounded-full ring-offset-2 ring-offset-white",
                  checked && "ring-2",
                )}
              />
            )}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
