/**
 * Assinatura da marca com par claro/escuro.
 *
 * Segue a convenção de `cadastro` e `onboarding` (par casado de SVGs bundled).
 * A página de login real mistura duas famílias de arte — um `/images/logos/`
 * para claro e o componente bundled para escuro, com proporções diferentes.
 * Isso é bug conhecido dela; não replicar aqui.
 */

import BecultureSignature from "@/assets/branding/beculture-signature.svg?react";
import BecultureSignatureDark from "@/assets/branding/beculture-signature-dark.svg?react";

export function LogoBeculture({ className = "mx-auto h-12 w-auto" }: { className?: string }) {
  return (
    <>
      <BecultureSignature className={`${className} dark:hidden`} />
      <BecultureSignatureDark className={`${className} hidden dark:block`} />
    </>
  );
}
