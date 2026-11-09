import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { ElementType, ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";

/**
 * Casca das telas do Lab: "← Voltar ao Lab", ícone, título com ajuda, selo
 * opcional e subtítulo. É o cabeçalho que Apresentação e Planilha já tinham —
 * agora uma peça só para todas as ferramentas.
 */
export function LabPagina({
  titulo,
  subtitulo,
  Icone,
  tint,
  ajuda,
  selo,
  children,
}: {
  titulo: string;
  subtitulo: ReactNode;
  Icone: ElementType;
  /** Classes do tile do ícone, ex.: "bg-orange-500/10 text-orange-500". */
  tint: string;
  /** Conteúdo do botão de ajuda ao lado do título. */
  ajuda: ReactNode;
  /** Selo ao lado do título (ex.: "Revisar o plano"); omitido = sem selo. */
  selo?: string | null;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  return (
    <Page title={`${titulo} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="mx-auto max-w-4xl">
          <div>
            <Link
              to={`/${product.code}/ia`}
              className="dark:text-dark-300 dark:hover:text-dark-100 mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <ArrowLeftIcon className="size-4" />
              Voltar ao Lab
            </Link>

            {/* O ícone é apoio, não protagonista: quem abre a leitura é o título
              (`PageTitle`, text-2xl). Por isso size-9 e não size-11. */}
            <div className="mb-8 flex items-center gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${tint}`}
              >
                <Icone className="size-5 stroke-[1.5]" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <PageTitle help={{ description: ajuda }}>{titulo}</PageTitle>
                  {selo && (
                    <span className="dark:bg-dark-600 dark:text-dark-200 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                      {selo}
                    </span>
                  )}
                </div>
                <p className="dark:text-dark-300 text-sm text-gray-500">
                  {subtitulo}
                </p>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </Page>
  );
}
