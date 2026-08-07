/**
 * Moldura das telas 1–3 (criar conta, organização, login).
 *
 * Mesma estrutura de `cadastro`/`onboarding`/`Auth`: main centralizado,
 * assinatura da marca, título + subtítulo, e o conteúdo num Card.
 */

import clsx from "clsx";
import type { ReactNode } from "react";

import { Page } from "@/components/shared/Page";
import { PageTitle, type PageHelp } from "@/components/shared/PageTitle";
import { Card } from "@/components/ui";

import { LogoBeculture } from "./LogoBeculture";

interface MolduraAuthProps {
  /** Título do documento (aba do navegador). */
  tituloPagina: string;
  /** Texto pequeno em caixa alta acima do título. */
  kicker?: string;
  titulo: string;
  subtitulo?: ReactNode;
  help?: PageHelp;
  /** Largura máxima do bloco. Login usa 26rem; formulários maiores, 34rem. */
  largura?: string;
  children: ReactNode;
  /** Conteúdo entre o cabeçalho e o Card (ex.: stepper). */
  antesDoCard?: ReactNode;
  /** Conteúdo abaixo do Card (ex.: links de rodapé). */
  depoisDoCard?: ReactNode;
}

export function MolduraAuth({
  tituloPagina,
  kicker,
  titulo,
  subtitulo,
  help,
  largura = "max-w-[34rem]",
  children,
  antesDoCard,
  depoisDoCard,
}: MolduraAuthProps) {
  return (
    <Page title={tituloPagina}>
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center py-8">
        <div className={clsx("mx-auto w-full", largura, "p-4 sm:px-5")}>
          <div className="flex flex-col items-center text-center">
            <LogoBeculture />
            <div className="mt-4 w-full">
              {kicker && (
                <p className="text-tiny-plus font-semibold tracking-wider text-primary-600 uppercase dark:text-primary-400">
                  {kicker}
                </p>
              )}
              {/*
                O botão de ajuda ("?") entra na mesma linha do título e empurra
                o texto para a esquerda do eixo central. O padding inicial de
                mesma largura (botão 24px + gap 8px) devolve o título ao centro,
                alinhado com o logo e com o Card.
              */}
              <PageTitle
                help={help}
                wrapperClassName={clsx("justify-center", help && "ps-8")}
                className="dark:text-dark-100 text-2xl font-semibold tracking-wide text-gray-600"
              >
                {titulo}
              </PageTitle>
              {subtitulo && (
                <p className="mt-1 text-gray-400 dark:text-dark-300">{subtitulo}</p>
              )}
            </div>
          </div>

          {antesDoCard}

          {/*
            `skin` e fundo explícitos: o Card lê `cardSkin` do tema (configuração
            editável pelo usuário) e o skin "bordered" não define background —
            depende de `[data-card-skin="bordered"] body` ser branco. Fixando
            aqui, o protótipo renderiza igual qualquer que seja a configuração.
          */}
          <Card
            skin="bordered"
            className="mt-5 rounded-lg bg-white p-5 lg:p-7 dark:bg-dark-900"
          >
            {children}
          </Card>

          {depoisDoCard}
        </div>
      </main>
    </Page>
  );
}
