/**
 * Assinatura da marca com par claro/escuro.
 *
 * Segue a convenção de `cadastro` e `onboarding` (par casado de SVGs bundled).
 * A página de login real mistura duas famílias de arte — um `/images/logos/`
 * para claro e o componente bundled para escuro, com proporções diferentes.
 * Isso é bug conhecido dela; não replicar aqui.
 */

import OracleSignature from "@/assets/branding/oracle-signature.svg?react";
import OracleSignatureDark from "@/assets/branding/oracle-signature-dark.svg?react";

export function LogoOracle({ className = "mx-auto h-12 w-auto" }: { className?: string }) {
  return (
    <>
      <OracleSignature className={`${className} dark:hidden`} />
      <OracleSignatureDark className={`${className} hidden dark:block`} />
    </>
  );
}
