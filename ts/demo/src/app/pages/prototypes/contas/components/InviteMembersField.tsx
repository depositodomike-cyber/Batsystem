/**
 * Campo de convites por e-mail (múltiplos), Step 2 corporativo.
 *
 * Espelha o padrão visual de `EtapaTime` do onboarding legado, sem acoplar
 * àquele funil: o estado dos e-mails fica no formulário do Step 2.
 */

import { EnvelopeIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { Button, Input } from "@/components/ui";

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

export function InviteMembersField({
  emails,
  onChange,
  emailDoUsuario,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  /** Evita convidar a própria conta. */
  emailDoUsuario?: string;
}) {
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = () => {
    const email = rascunho.trim().toLowerCase();
    if (email === "") {
      setErro("Informe um e-mail.");
      return;
    }
    if (!emailValido(email)) {
      setErro("E-mail inválido.");
      return;
    }
    if (
      emailDoUsuario &&
      email === emailDoUsuario.trim().toLowerCase()
    ) {
      setErro("Esse já é o e-mail da sua conta.");
      return;
    }
    if (emails.some((e) => e.toLowerCase() === email)) {
      setErro("Este e-mail já foi adicionado.");
      return;
    }
    onChange([...emails, email]);
    setRascunho("");
    setErro(null);
  };

  return (
    <div>
      <label className="dark:text-dark-100 input-label mb-1.5 block text-xs-plus text-gray-700">
        Convites por e-mail{" "}
        <span className="font-normal text-gray-400">(opcional)</span>
      </label>
      <div className="flex items-start gap-2">
        <Input
          placeholder="nome@empresa.com"
          type="email"
          autoComplete="off"
          classNames={{ root: "flex-1" }}
          prefix={
            <EnvelopeIcon
              className="size-5 transition-colors duration-200"
              strokeWidth="1"
            />
          }
          value={rascunho}
          onChange={(e) => {
            setRascunho(e.target.value);
            if (erro) setErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          error={erro ?? undefined}
        />
        <Button
          type="button"
          color="primary"
          variant="outlined"
          className="mt-0 size-10 shrink-0 p-0"
          onClick={adicionar}
          aria-label="Adicionar convidado"
        >
          <PlusIcon className="size-5" />
        </Button>
      </div>

      {emails.length > 0 && (
        <ul className="mt-3 space-y-2">
          {emails.map((email) => (
            <li
              key={email}
              className="dark:border-dark-600 dark:bg-dark-800 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <EnvelopeIcon
                className="dark:text-dark-300 size-4 shrink-0 text-gray-400"
                strokeWidth="1.5"
              />
              <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-700">
                {email}
              </span>
              <button
                type="button"
                aria-label={`Remover ${email}`}
                onClick={() =>
                  onChange(emails.filter((e) => e !== email))
                }
                className="dark:text-dark-300 dark:hover:text-dark-100 shrink-0 text-gray-400 transition-colors hover:text-gray-700"
              >
                <XMarkIcon className="size-4" strokeWidth="2" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
