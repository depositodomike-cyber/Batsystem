// Import Dependencies
import { useReducer } from "react";

// Local Imports
import {
  FormAction,
  FormState,
  KYCFormContextProvider,
} from "./KYCFormContext";

// ----------------------------------------------------------------------

const initialState: FormState = {
  formData: {
    personalInfo: {
      firstName: "",
      lastName: "",
      middleName: "",
      email: "",
      dialCode: "",
      phone: "",
      gender: "",
      dateOfBirth: null,
      matrialStatus: "",
      nationality: "",
    },
    addressInfo: {
      permanentAddress: {
        country: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zipCode: "",
      },
      isSameCorrespondenceAddress: true,
      correspondenceAddress: {
        country: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zipCode: "",
      },
    },
    identifyDocument: {
      type: "passport",
      imageFront: null,
      imageBack: null,
      passportPage: null,
    },
    declaration: {
      agreed: false,
      fullName: "",
      dateSigned: null,
    },
  },
  stepStatus: {
    personalInfo: {
      isDone: false,
    },
    addressInfo: {
      isDone: false,
    },
    identifyDocument: {
      isDone: false,
    },
    declaration: {
      isDone: false,
    },
  },
};

const reducer = (state: FormState, action: FormAction) => {
  switch (action.type) {
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: {
          ...state.formData,
          ...action.payload,
        },
      };
    case "SET_STEP_STATUS":
      return {
        ...state,
        stepStatus: {
          ...state.stepStatus,
          ...action.payload,
        },
      };
    default:
      return state;
  }
};

export function KYCFormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = { state, dispatch };
  return (
    <KYCFormContextProvider value={value}>{children}</KYCFormContextProvider>
  );
}
