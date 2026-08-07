/**
 * Campos da organização corporativa (Step 2, intenção "Empresa ou equipe").
 */

import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui";

export function OrganizationFields({
  registration,
  error,
}: {
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <Input
      label="Nome da organização"
      placeholder="Ex.: Prado Consultoria"
      autoComplete="organization"
      prefix={
        <BuildingOffice2Icon
          className="size-5 transition-colors duration-200"
          strokeWidth="1"
        />
      }
      {...registration}
      error={error}
    />
  );
}
