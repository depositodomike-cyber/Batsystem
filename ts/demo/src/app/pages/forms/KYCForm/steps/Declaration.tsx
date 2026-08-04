// Import Dependencies
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";

// Local Imports
import { ContextualHelp } from "@/components/shared/ContextualHelp";
import { DatePicker } from "@/components/shared/form/Datepicker";
import { PreviewImg } from "@/components/shared/PreviewImg";
import {
  Button,
  Checkbox,
  GhostSpinner,
  Input,
  InputErrorMsg,
} from "@/components/ui";
import { countries } from "@/constants/countries";
import { useKYCFormContext } from "../KYCFormContext";
import { AddressDetails, declarationSchema, DeclarationType } from "../schema";

// ----------------------------------------------------------------------

export function Declaration({
  setCurrentStep,
  setFinished,
}: {
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setFinished: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const kycFormCtx = useKYCFormContext();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<DeclarationType>({
    resolver: yupResolver(declarationSchema) as Resolver<DeclarationType>,
    defaultValues: kycFormCtx.state.formData.declaration,
  });

  const onSubmit = (data: DeclarationType) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      kycFormCtx.dispatch({
        type: "SET_FORM_DATA",
        payload: { declaration: { ...data } },
      });
      kycFormCtx.dispatch({
        type: "SET_STEP_STATUS",
        payload: { declaration: { isDone: true } },
      });
      setFinished(true);
    }, 2000);
  };

  const personalInfo = kycFormCtx.state.formData.personalInfo;
  const addressInfo = kycFormCtx.state.formData.addressInfo;
  const identifyDocument = kycFormCtx.state.formData.identifyDocument;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="max-w-3xl"
    >
      <h6 className="dark:border-dark-500 dark:text-dark-200 mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-700">
        Personal Information:
      </h6>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            First Name:
          </p>
          <p>{personalInfo.firstName}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Middle Name:
          </p>
          <p>{personalInfo.middleName || "---"}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Last Name:
          </p>
          <p>{personalInfo.lastName}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Email:
          </p>
          <p>{personalInfo.email}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Phone:
          </p>
          <p>
            {personalInfo.dialCode} {personalInfo.phone}
          </p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Gender:
          </p>
          <p>{personalInfo.gender}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Matrial Status:
          </p>
          <p>{personalInfo.matrialStatus}</p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Nationality:
          </p>
          <p>
            {countries.find((c) => c.code === personalInfo.nationality)?.name}
          </p>
        </div>
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Date of Birth:
          </p>
          <p>{dayjs(personalInfo.dateOfBirth).format("DD.MM.YYYY")}</p>
        </div>
      </div>

      <h6 className="dark:border-dark-500 dark:text-dark-200 mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-700">
        Permanent Address:
      </h6>

      {getAddressNode(addressInfo.permanentAddress)}

      <h6 className="dark:border-dark-500 dark:text-dark-200 mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-700">
        Correspondence Address:
      </h6>

      {addressInfo.isSameCorrespondenceAddress &&
        addressInfo.correspondenceAddress &&
        getAddressNode(
          addressInfo.isSameCorrespondenceAddress
            ? addressInfo.permanentAddress
            : addressInfo.correspondenceAddress,
        )}

      <h6 className="dark:border-dark-500 dark:text-dark-200 mt-8 border-b border-gray-200 pb-2 text-base font-semibold text-gray-700">
        Identification:
      </h6>

      <div className="mt-4">
        <div>
          <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
            Document Type:
          </p>
          <p>{identifyDocument.type}</p>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div>
            <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
              {identifyDocument.type === "passport"
                ? "Passport Cover:"
                : "Front Image:"}
            </p>
            <div className="dark:border-dark-500 mt-2 h-64 rounded-md border p-2">
              <PreviewImg
                file={identifyDocument.imageFront}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div>
            <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
              {identifyDocument.type === "passport"
                ? "Passport Page:"
                : "Back Image:"}
            </p>
            <div className="dark:border-dark-500 mt-2 h-64 rounded-md border p-2">
              <PreviewImg
                file={
                  identifyDocument.type === "passport"
                    ? identifyDocument.passportPage
                    : identifyDocument.imageBack
                }
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col">
            <Checkbox
              {...register("agreed")}
              label={
                <>
                  I agree to the{" "}
                  <a
                    href="##"
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    terms and conditions
                  </a>
                </>
              }
            />
            <InputErrorMsg when={!!errors?.agreed}>
              {errors?.agreed?.message}
            </InputErrorMsg>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              {...register("fullName")}
              label="Signature"
              placeholder="Enter Your Full Name"
              error={errors?.fullName?.message}
              suffix={
                <ContextualHelp
                  title="Important Note!"
                  content={
                    <p>
                      By typing your full name above, you are providing us with
                      your digital signature, which is as legally binding as
                      your physical signature. Please note that your signature
                      must exactly match the first and last names that you
                      entered at the top of this web form in order for your
                      submission to be successful.
                    </p>
                  }
                />
              }
            />

            <div className="flex flex-col">
              <Controller
                render={({ field: { onChange, value, ...rest } }) => (
                  <DatePicker
                    onChange={onChange}
                    value={value || ""}
                    label="Date Signed"
                    error={errors?.dateSigned?.message}
                    options={{ disableMobile: true }}
                    placeholder="Choose date..."
                    {...rest}
                  />
                )}
                control={control}
                name="dateSigned"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-end space-x-3">
        <Button className="min-w-[7rem]" onClick={() => setCurrentStep(2)}>
          Back
        </Button>
        <Button
          type="submit"
          className="min-w-[7rem] space-x-2"
          color="primary"
          disabled={loading}
        >
          {loading && <GhostSpinner className="size-4 border-2" />}

          <span>Finish</span>
        </Button>
      </div>
    </form>
  );
}

function getAddressNode(address: AddressDetails) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          Country:
        </p>
        <p>{countries.find((c) => c.code === address.country)?.name}</p>
      </div>
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          City:
        </p>
        <p>{address.city}</p>
      </div>
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          State:
        </p>
        <p>{address.state}</p>
      </div>
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          Zipcode:
        </p>
        <p>{address.zipCode}</p>
      </div>
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          Address Line 1:
        </p>
        <p>{address.addressLine1}</p>
      </div>
      <div>
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          Address Line 2:
        </p>
        <p>{address.addressLine2 || "---"}</p>
      </div>
    </div>
  );
}
