import { createSafeContext } from "@/utils/createSafeContext";
import { Dispatch } from "react";
import { GeneralType, DescriptionType, ImageType } from "./schema";

// Define the context state and action types
export interface StepStatus {
  isDone: boolean;
}

export interface FormState {
  formData: {
    general: GeneralType;
    description: DescriptionType;
    images: ImageType;
  };
  stepStatus: {
    general: StepStatus;
    description: StepStatus;
    images: StepStatus;
  };
}

export type FormAction =
  | { type: "SET_FORM_DATA"; payload: Partial<FormState["formData"]> }
  | { type: "SET_STEP_STATUS"; payload: Partial<FormState["stepStatus"]> };

export interface AddProductFormContextType {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export const [AddProductFormContextProvider, useAddProductFormContext] =
  createSafeContext<AddProductFormContextType>(
    "useAddProductFormContext must be used within a AddProductFormProvider",
  );
