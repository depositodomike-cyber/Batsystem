// Pedido de aprovação de uma ação de escrita do orquestrador. Mostra o que vai
// acontecer (o resumo do servidor) e, sob demanda, os parâmetros EXATOS que
// serão executados — é isso que o usuário aprova. Nada roda sem o clique.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import { Button, Spinner } from "@/components/ui";
import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import type { AprovacaoDoTurno } from "@/app/contexts/assistente/context";
import type { ParecerRevisao } from "@/services/api/orquestrador";

// ----------------------------------------------------------------------

/**
 * Parecer do revisor de segurança. Só ocupa espaço quando há algo a dizer:
 * "seguir" sem motivos vira uma linha discreta; "atenção" e falha da revisão
 * aparecem com destaque e os motivos.
 */
function Revisao({ parecer }: { parecer: ParecerRevisao }) {
  const { t } = useTranslation();
  const alerta = parecer.recomendacao !== "seguir" || parecer.nivel === "alto";
  if (!alerta) {
    return (
      <p className="dark:text-dark-300 mt-1 text-xs text-gray-500">
        {t("chrome.assistantReviewOk")}
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
      <p className="flex items-center gap-1 font-semibold">
        <ExclamationTriangleIcon className="size-3.5 shrink-0" />
        {parecer.falhou
          ? t("chrome.assistantReviewUnavailable")
          : t("chrome.assistantReviewAttention", {
              nivel: t(`chrome.assistantReviewLevel_${parecer.nivel}`),
            })}
      </p>
      {!parecer.falhou && parecer.motivos.length > 0 && (
        <ul className="mt-0.5 list-disc ps-4">
          {parecer.motivos.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AprovacaoCard({
  aprovacao,
  bloqueado,
  onDecidir,
}: {
  aprovacao: AprovacaoDoTurno;
  /** Outra decisão em curso: os botões ficam travados. */
  bloqueado?: boolean;
  onDecidir: (aprovar: boolean) => void;
}) {
  const { t } = useTranslation();
  const [verDetalhes, setVerDetalhes] = useState(false);
  const conteudo =
    typeof aprovacao.entrada.conteudo === "string" ? aprovacao.entrada.conteudo : null;
  const outros = Object.entries(aprovacao.entrada).filter(([k]) => k !== "conteudo");
  const travado = bloqueado || aprovacao.enviando;

  return (
    <div className="border-warning/40 bg-warning/5 dark:border-warning/30 mt-2 rounded-lg border p-3">
      <p className="dark:text-dark-100 flex items-start gap-1.5 text-xs font-semibold text-gray-800">
        <ShieldCheckIcon className="text-warning mt-px size-4 shrink-0" />
        {t("chrome.assistantApprovalTitle")}
      </p>
      <p className="dark:text-dark-200 mt-1 text-sm break-words text-gray-700">{aprovacao.resumo}</p>
      {aprovacao.revisao && <Revisao parecer={aprovacao.revisao} />}

      <button
        type="button"
        onClick={() => setVerDetalhes((v) => !v)}
        aria-expanded={verDetalhes}
        className="dark:text-dark-300 dark:hover:text-dark-100 mt-1 text-xs text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
      >
        {verDetalhes ? t("chrome.assistantApprovalHide") : t("chrome.assistantApprovalShow")}
      </button>
      {verDetalhes && (
        <div className="dark:border-dark-500 dark:bg-dark-800 mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-xs">
          {outros.map(([k, v]) => (
            <p key={k} className="break-words">
              <span className="font-semibold">{k}:</span> {String(v)}
            </p>
          ))}
          {conteudo && (
            <div className="mt-1">
              <MarkdownView>{conteudo}</MarkdownView>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          color="primary"
          disabled={travado}
          onClick={() => onDecidir(true)}
          className="h-8 rounded-lg px-3 text-xs"
        >
          {aprovacao.enviando ? <Spinner className="size-3.5" /> : t("chrome.assistantApprove")}
        </Button>
        <Button
          variant="outlined"
          disabled={travado}
          onClick={() => onDecidir(false)}
          className="h-8 rounded-lg px-3 text-xs"
        >
          {t("chrome.assistantDeny")}
        </Button>
      </div>
    </div>
  );
}
