import { createSafeContext } from "@/utils/createSafeContext";
import {
  AddressInfoType,
  DeclarationType,
  IdentifyDocumentType,
  PersonalInfoType,
} from "./schema";
import { Dispatch } from "react";

export interface StepStatus {
  isDone: boolean;
}

export type StepKey =
  | "personalInfo"
  | "addressInfo"
  | "identifyDocument"
  | "declaration";

export interface FormState {
  readonly formData: {
    personalInfo: PersonalInfoType;
    addressInfo: AddressInfoType;
    identifyDocument: IdentifyDocumentType;
    declaration: DeclarationType;
  };
  readonly stepStatus: {
    [key in StepKey]: StepStatus;
  };
}

export type FormAction =
  | { type: "SET_FORM_DATA"; payload: Partial<FormState["formData"]> }
  | { type: "SET_STEP_STATUS"; payload: Partial<FormState["stepStatus"]> };

export interface AddProductFormContextType {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export const [KYCFormContextProvider, useKYCFormContext] =
  createSafeContext<AddProductFormContextType>(
    "useKYCFormContext must be used within a KYCFormContextProvider",
  );
