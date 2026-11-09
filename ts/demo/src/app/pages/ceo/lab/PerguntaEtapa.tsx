import clsx from "clsx";
import type { ReactNode } from "react";

/** A pergunta que abre uma etapa do wizard — o que o usuário está decidindo. */
export function PerguntaEtapa({
  children,
  className = "mb-3",
}: {
  children: ReactNode;
  /** Sobrescreve a margem inferior. `""` para a pergunta dividir a linha com
      outro controle, onde o espaçamento passa a ser do contêiner. */
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "dark:text-dark-100 text-sm font-medium text-gray-700",
        className,
      )}
    >
      {children}
    </p>
  );
}
