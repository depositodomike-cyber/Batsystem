/**
 * Cabeçalho de seção numerada.
 *
 * Clonado localmente em vez de importado do `SectionHeading` de
 * `@/components/shared/Precificador`: aquele módulo arrasta PLANOS, MODULOS e
 * toda a tabela de precificação como dependência, e o protótipo não precisa de
 * nada disso.
 */

import type { ReactNode } from "react";

export function TituloSecao({
  numero,
  titulo,
  subtitulo,
}: {
  numero: number;
  titulo: string;
  subtitulo?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-slate-900">
        {numero}
      </span>
      <div className="min-w-0">
        <h3 className="dark:text-dark-100 text-base font-medium text-gray-800">
          {titulo}
        </h3>
        {subtitulo && (
          <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-400">
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}
