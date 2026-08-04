// Import Dependencies
import { useReducer } from "react";

// Local Imports
import {
  AddProductFormContextProvider,
  FormState,
  FormAction,
} from "./AddProductFormContext";
import { Delta } from "@/components/shared/form/TextEditor";

// ----------------------------------------------------------------------

// Using FormState instead of local InitialState
const initialState: FormState = {
  formData: {
    general: {
      title: "",
      sku: "",
      price: 0,
      category_id: "",
      brand_id: "",
      inStock: true,
      selling_type: "",
    },
    description: {
      short_description: "",
      description: new Delta(),
      meta_title: "",
      meta_description: "",
      meta_keywords: [],
    },
    images: {
      gallery: [],
      cover: "",
    },
  },
  stepStatus: {
    general: {
      isDone: false,
    },
    description: {
      isDone: false,
    },
    images: {
      isDone: false,
    },
  },
};

const reducerHandlers = {
  SET_FORM_DATA: (state: FormState, action: FormAction) => {
    if (action.type !== "SET_FORM_DATA") return state;
    return {
      ...state,
      formData: {
        ...state.formData,
        ...action.payload,
      },
    };
  },
  SET_STEP_STATUS: (state: FormState, action: FormAction) => {
    if (action.type !== "SET_STEP_STATUS") return state;
    return {
      ...state,
      stepStatus: {
        ...state.stepStatus,
        ...action.payload,
      },
    };
  },
};

const reducer = (state: FormState, action: FormAction): FormState =>
  reducerHandlers[action.type]?.(state, action) || state;

export function AddProductFormProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = { state, dispatch };
  return (
    <AddProductFormContextProvider value={value}>
      {children}
    </AddProductFormContextProvider>
  );
}
