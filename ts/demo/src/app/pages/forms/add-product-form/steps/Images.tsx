// Import Dependencies
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, Resolver, useForm } from "react-hook-form";
import { useState } from "react";
import { FileWithPath } from "react-dropzone";

// Local Imports
import { Button, GhostSpinner } from "@/components/ui";
import { useAddProductFormContext } from "../AddProductFormContext";
import { CoverImageUpload } from "../components/CoverImageUpload";
import { GalleryImageUpload } from "../components/GalleryImageUpload";
import { imageSchema, ImageType } from "../schema";

// ----------------------------------------------------------------------

export function Images({
  setCurrentStep,
  setFinished,
}: {
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setFinished: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const addProductFormCtx = useAddProductFormContext();
  const [loading, setLoading] = useState(false);

  const {
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<ImageType>({
    resolver: yupResolver(imageSchema) as Resolver<ImageType>,
    defaultValues: addProductFormCtx.state.formData.images,
  });

  const onSubmit = (data: ImageType) => {
    setLoading(true);
    setTimeout(() => {
      addProductFormCtx.dispatch({
        type: "SET_FORM_DATA",
        payload: { images: data },
      });
      addProductFormCtx.dispatch({
        type: "SET_STEP_STATUS",
        payload: { images: { isDone: true } },
      });
      setLoading(false);
      setFinished(true);
    }, 2000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <div className="space-y-4">
        <Controller
          render={({ field: { onChange, value, ...fieldProps } }) => (
            <CoverImageUpload
              label="CTA Image"
              classNames={{
                box: "mt-1.5",
              }}
              error={errors?.cover?.message}
              value={value as File}
              onChange={onChange}
              {...fieldProps}
            />
          )}
          name="cover"
          control={control}
        />

        <Controller
          render={({ field: { onChange, value, ...fieldProps } }) => (
            <GalleryImageUpload
              label={
                <p className="mb-1.5">
                  Image Gallery{" "}
                  <span className="dark:text-dark-300 text-xs text-gray-400">
                    (Optional)
                  </span>
                </p>
              }
              error={errors?.gallery?.message}
              value={(value as FileWithPath[]) || []}
              onChange={onChange}
              {...fieldProps}
            />
          )}
          name="gallery"
          control={control}
        />
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <Button className="min-w-[7rem]" onClick={() => setCurrentStep(1)}>
          Prev
        </Button>
        <Button
          type="submit"
          className="min-w-[7rem] gap-2"
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
