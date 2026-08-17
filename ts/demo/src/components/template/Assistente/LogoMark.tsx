// Marca da beculture usada como avatar do assistente. Segue o idioma do
// ProductSwitcher (par casado de SVGs claro/escuro). Decorativa: o rótulo
// acessível vem sempre do elemento que a contém.
import clsx from "clsx";

import becultureLogo from "@/assets/branding/beculture-logo.svg";
import becultureLogoDark from "@/assets/branding/beculture-logo-dark.svg";

// ----------------------------------------------------------------------

interface LogoMarkProps {
  className?: string;
  /** Fixa a arte clara — para uso sobre fundo branco nos dois temas. */
  onLight?: boolean;
}

export function LogoMark({ className, onLight = false }: LogoMarkProps) {
  if (onLight) {
    return <img src={becultureLogo} alt="" aria-hidden className={className} />;
  }
  return (
    <>
      <img
        src={becultureLogo}
        alt=""
        aria-hidden
        className={clsx(className, "dark:hidden")}
      />
      <img
        src={becultureLogoDark}
        alt=""
        aria-hidden
        className={clsx(className, "hidden dark:block")}
      />
    </>
  );
}
