import type { ReactNode } from "react";

import { BrandLoadingSplash } from "@/components/shared/BrandLoadingSplash";

import { CARD_LAB } from "./estilos";

/**
 * Card de carregamento do Lab. Indeterminado por padrão: quando o servidor não
 * informa progresso, inventar "8 de 12" seria encenação. Quem tem progresso de
 * verdade (exportação de vídeo, fases da análise) passa em `children`.
 */
export function LabCarregando({
  titulo,
  descricao,
  children,
  semCard = false,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  children?: ReactNode;
  /** Sem a moldura do card (uso dentro de uma janela). */
  semCard?: boolean;
}) {
  const conteudo = (
    <div aria-live="polite" className="grid place-items-center py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLoadingSplash label={null} />
        <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
          {titulo}
        </p>
        {descricao && (
          <p className="dark:text-dark-300 text-sm text-gray-500">
            {descricao}
          </p>
        )}
        {children}
      </div>
    </div>
  );
  return semCard ? conteudo : <div className={CARD_LAB}>{conteudo}</div>;
}
