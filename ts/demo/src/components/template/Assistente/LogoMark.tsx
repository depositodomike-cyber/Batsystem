// Marca do Oracle usada como avatar do assistente. Segue o idioma do
// ProductSwitcher (par casado de SVGs claro/escuro). Decorativa: o rótulo
// acessível vem sempre do elemento que a contém.
import clsx from "clsx";

import oracleLogo from "@/assets/branding/oracle-logo.svg";
import oracleLogoDark from "@/assets/branding/oracle-logo-dark.svg";

// ----------------------------------------------------------------------

interface LogoMarkProps {
  className?: string;
  /** Fixa a arte clara — para uso sobre fundo branco nos dois temas. */
  onLight?: boolean;
}

export function LogoMark({ className, onLight = false }: LogoMarkProps) {
  if (onLight) {
    return <img src={oracleLogo} alt="" aria-hidden className={className} />;
  }
  return (
    <>
      <img
        src={oracleLogo}
        alt=""
        aria-hidden
        className={clsx(className, "dark:hidden")}
      />
      <img
        src={oracleLogoDark}
        alt=""
        aria-hidden
        className={clsx(className, "hidden dark:block")}
      />
    </>
  );
}
