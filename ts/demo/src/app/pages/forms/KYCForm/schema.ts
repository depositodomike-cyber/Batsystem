// Import Dependencies
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import * as Yup from "yup";

// ----------------------------------------------------------------------

dayjs.extend(isBetween);

export type DocumentType = "passport" | "driverLicense" | "nationalID";

export const personalInfoSchema = Yup.object().shape({
  // Personal Information
  firstName: Yup.string().trim().required("First Name Required"),
  lastName: Yup.string().trim().required("Last Name Required"),
  middleName: Yup.string().trim(),
  email: Yup.string().trim().email("Invalid Email").required("Email Required"),
  dialCode: Yup.string().trim().required("Choose Country Dial Code"),
  phone: Yup.string()
    .trim()
    .matches(/^[0-9\-s]+$/, "Enter Correct Phone Number")
    .required("Enter Your Phone Number"),
  gender: Yup.string().trim().required("Choose Your Gender"),
  dateOfBirth: Yup.date()
    .test("valid-age", "You must be at least 18 years old", (value) => {
      return dayjs().diff(dayjs(value), "year") >= 18;
    })
    .required("Choose Your Birth Date"),
  matrialStatus: Yup.string().trim().required("Choose Your Matrial Status"),
  nationality: Yup.string().trim().required("Choose Your Nationality"),
});

export const addressInfoSchema = Yup.object().shape({
  permanentAddress: Yup.object().shape({
    country: Yup.string().required("Choose Your Country"),
    city: Yup.string().required("City Required"),
    state: Yup.string().required("State Required"),
    zipCode: Yup.string().required("Zip Code Required"),
    addressLine1: Yup.string().required("Address Line 1 Required"),
    addressLine2: Yup.string(),
  }),
  isSameCorrespondenceAddress: Yup.bool(),
  correspondenceAddress: Yup.object().when("isSameCorrespondenceAddress", {
    is: false,
    then: (schema) =>
      schema.shape({
        country: Yup.string().required("Choose Your Country"),
        city: Yup.string().required("City Required"),
        state: Yup.string().required("State Required"),
        zipCode: Yup.string().required("Zip Code Required"),
        addressLine1: Yup.string().required("Address Line 1 Required"),
        addressLine2: Yup.string(),
      }),
    otherwise: (schema) => schema.optional().nullable(),
  }),
});

export const identifyDocumentSchema = Yup.object().shape({
  type: Yup.string()
    .oneOf(["passport", "driverLicense", "nationalID"] as const)
    .required("Choose Your Document Type"),
  imageFront: Yup.mixed()
    .nullable()
    .required("You need to provide a file")
    .test(
      "fileSize",
      "Max file size should be 4MB",
      (value: any) => !value || (value && (value as File).size <= 4194304),
    ),
  imageBack: Yup.mixed()
    .nullable()
    .when("type", {
      is: (type: DocumentType) => type !== "passport",
      then: () =>
        Yup.mixed()
          .required("You need to provide a file")
          .test(
            "fileSize",
            "Max file size should be 4MB",
            (value: any) =>
              !value || (value && (value as File).size <= 4194304),
          ),
      otherwise: (schema) => schema,
    }),
  passportPage: Yup.mixed()
    .nullable()
    .when("type", {
      is: "passport" as const,
      then: () =>
        Yup.mixed()
          .required("You need to provide a file")
          .test(
            "fileSize",
            "Max file size should be 4MB",
            (value: any) =>
              !value || (value && (value as File).size <= 4194304),
          ),
      otherwise: (schema) => schema,
    }),
});

export const declarationSchema = Yup.object().shape({
  agreed: Yup.boolean()
    .oneOf(
      [true],
      "To use our service, you need to consent to the terms and conditions.",
    )
    .required("Agreed Required"),
  fullName: Yup.string().required("Full Name Required"),
  dateSigned: Yup.date()
    .test(
      "valid-date-signed",
      "Date signed must be within the last seven days",
      (value) => {
        return dayjs(value).isBetween(dayjs(), dayjs().subtract(7, "day"));
      },
    )
    .max(new Date())
    .required(),
});

export type PersonalInfoType = {
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  dialCode: string;
  phone: string;
  gender: string;
  dateOfBirth: Date | null;
  matrialStatus: string;
  nationality: string;
};

export type AddressDetails = {
  country: string;
  city: string;
  state: string;
  zipCode: string;
  addressLine1: string;
  addressLine2?: string;
};

export type AddressInfoType = {
  permanentAddress: AddressDetails;
  isSameCorrespondenceAddress?: boolean;
  correspondenceAddress?: AddressDetails; 
};

export type IdentifyDocumentType = {
  type: DocumentType;
  imageFront: File | null;
  imageBack?: File | null; 
  passportPage?: File | null; 
};

export type DeclarationType = {
  agreed: boolean;
  fullName: string;
  dateSigned: Date | null;
};
