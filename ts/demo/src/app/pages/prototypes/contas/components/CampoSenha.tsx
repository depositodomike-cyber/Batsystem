/**
 * Campo de senha com botão de mostrar/ocultar.
 * Clone do `PasswordInput` local de `@/app/pages/cadastro`.
 */

import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui";

export function CampoSenha({
  label,
  placeholder,
  description,
  registration,
  error,
  classNames,
}: {
  label: string;
  placeholder: string;
  description?: string;
  registration: UseFormRegisterReturn;
  error?: string;
  classNames?: { root?: string };
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Input
      label={label}
      placeholder={placeholder}
      description={description}
      classNames={classNames}
      type={visivel ? "text" : "password"}
      autoComplete="new-password"
      prefix={
        <LockClosedIcon
          className="size-5 transition-colors duration-200"
          strokeWidth="1"
        />
      }
      suffix={
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="pointer-events-auto flex size-full items-center justify-center text-gray-400 transition-colors hover:text-gray-600 dark:text-dark-300 dark:hover:text-dark-100"
        >
          {visivel ? (
            <EyeSlashIcon className="size-5" strokeWidth="1.5" />
          ) : (
            <EyeIcon className="size-5" strokeWidth="1.5" />
          )}
        </button>
      }
      {...registration}
      error={error}
    />
  );
}
