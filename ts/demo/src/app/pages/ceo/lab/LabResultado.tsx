import { CheckIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { CAIXA_ERRO, CARD_LAB } from "./estilos";

/**
 * Card de resultado do Lab — o "pronta" de Apresentação e Planilha: ícone de
 * check, título e descrição; abaixo, o conteúdo gerado (opcional); no rodapé,
 * ações secundárias à esquerda e as principais à direita.
 */
export function LabResultado({
  titulo,
  descricao,
  detalhe,
  erro,
  acoesSecundarias,
  acoesPrincipais,
  children,
  semCard = false,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Linha extra sob a descrição (ex.: "12 slides · PowerPoint"). */
  detalhe?: ReactNode;
  erro?: string | null;
  acoesSecundarias?: ReactNode;
  acoesPrincipais?: ReactNode;
  /** O conteúdo gerado, entre o cabeçalho e o rodapé. */
  children?: ReactNode;
  /** Sem a moldura do card (uso dentro de uma janela). */
  semCard?: boolean;
}) {
  const conteudo = (
    <>
      <div className="flex items-start gap-3">
        <span className="bg-primary-500 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-slate-900">
          <CheckIcon className="size-4" strokeWidth="2.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
            {titulo}
          </h3>
          {descricao && (
            <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
              {descricao}
            </p>
          )}
          {detalhe && (
            <p className="dark:text-dark-300 mt-2 text-sm text-gray-500">
              {detalhe}
            </p>
          )}
        </div>
      </div>

      {children && <div className="mt-5">{children}</div>}

      {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

      {(acoesSecundarias || acoesPrincipais) && (
        <div className="dark:border-dark-600 mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {acoesSecundarias}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {acoesPrincipais}
          </div>
        </div>
      )}
    </>
  );
  return semCard ? conteudo : <div className={CARD_LAB}>{conteudo}</div>;
}
