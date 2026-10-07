// Aba Chat do painel: estado vazio ou a lista de turnos da conversa atual.
//
// Respostas de agentes aparecem como a participação de outra pessoa no chat:
// avatar + nome do agente acima do conteúdo. Com vários agentes @mencionados,
// cada um tem o seu bloco (turnos de `continuacao`), na ordem das menções, e
// cada bloco sai do "pensando…" quando a SUA resposta chega.
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import { useAssistente, type Turno } from "@/app/contexts/assistente/context";
import { useAgentes } from "@/app/contexts/agentes/context";
import { chaveMencao } from "@/services/api/agentes";
import { AgenteAvatar } from "@/components/shared/AgenteAvatar";
import { Fontes } from "./Fontes";
import { LogoMark } from "./LogoMark";
import { ArquivoCard } from "./ArquivoCard";

// ----------------------------------------------------------------------

const TOKEN = /(@[\p{L}\p{N}]+)/u;

/**
 * Pergunta com as @menções reconhecidas destacadas. Reconhecida = gravada com
 * a mensagem (`mencoes`) ou, num turno ainda sem gravação, um agente existente.
 */
function PerguntaComMencoes({
  texto,
  chaves,
}: {
  texto: string;
  chaves: Set<string>;
}) {
  const partes = texto.split(TOKEN);
  const nos: ReactNode[] = partes.map((parte, i) =>
    TOKEN.test(parte) && chaves.has(chaveMencao(parte)) ? (
      <span
        key={i}
        className="bg-primary-600/10 dark:bg-primary-400/10 rounded px-1"
      >
        {parte}
      </span>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    ),
  );
  return <>{nos}</>;
}

export function ChatTab() {
  const { t } = useTranslation();
  const { conversa, loading, expandido } = useAssistente();
  const { porId, todos } = useAgentes();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Rola para o fim quando chega novo conteúdo. `expandido` entra nas deps
  // porque alternar o tamanho muda a altura do container.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [conversa, loading, expandido]);

  if (conversa.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <LogoMark className="size-12 shrink-0" />
        <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-800">
          {t("chrome.assistantEmptyTitle")}
        </p>
        <p className="dark:text-dark-300 mt-1 text-xs text-gray-500">
          {t("chrome.assistantEmptyHint")}
        </p>
      </div>
    );
  }

  const chavesDosAgentes = new Set(todos.map((a) => chaveMencao(a.mencao)));
  const chavesDo = (turno: Turno) =>
    turno.mencoes?.length
      ? new Set(turno.mencoes.map((m) => chaveMencao(m.mencao)))
      : chavesDosAgentes;

  return (
    <div
      ref={bodyRef}
      aria-live="polite"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
    >
      {/* Scroller full-bleed, conteúdo limitado: no modo ampliado a barra de
          rolagem continua na borda e as linhas não esticam. */}
      <div className={clsx(expandido && "mx-auto w-full max-w-3xl")}>
        {conversa.map((turno, i) => {
          // Identidade da resposta: o agente gravado no turno. O catálogo só
          // completa o ícone — se o agente foi excluído, fica o nome gravado.
          const conhecido = turno.agente ? porId(turno.agente.id) : undefined;
          const agente = turno.agente
            ? {
                titulo: turno.agente.titulo || conhecido?.titulo || "Agente",
                icone: conhecido?.icone ?? null,
              }
            : null;

          return (
            <div
              key={i}
              className={clsx(
                i > 0 &&
                  (turno.continuacao
                    ? "mt-4"
                    : "dark:border-dark-600 mt-4 border-t border-gray-100 pt-4"),
              )}
            >
              {turno.pergunta && !turno.continuacao && (
                <p className="text-primary-600 dark:text-primary-400 text-sm font-semibold break-words">
                  <PerguntaComMencoes
                    texto={turno.pergunta}
                    chaves={chavesDo(turno)}
                  />
                </p>
              )}
              {agente && (
                <p className="dark:text-dark-100 mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <AgenteAvatar titulo={agente.titulo} icone={agente.icone} />
                  <span className="truncate">{agente.titulo}</span>
                </p>
              )}
              <div className={agente ? "mt-1" : "mt-1.5"}>
                {turno.pendente ? (
                  <p className="dark:text-dark-300 flex items-center gap-2 text-sm text-gray-400">
                    <span className="border-primary-500 size-3 animate-spin rounded-full border-2 border-t-transparent" />
                    {t("chrome.assistantThinking")}
                  </p>
                ) : (
                  turno.resposta && <MarkdownView>{turno.resposta}</MarkdownView>
                )}
              </div>
              {!turno.pendente &&
                (turno.arquivos ?? []).map((arquivo) => (
                  <ArquivoCard
                    key={arquivo.id}
                    arquivo={arquivo}
                    mensagemId={turno.mensagemId}
                    geradoPor={arquivo.geradoPor?.titulo ?? turno.agente?.titulo}
                  />
                ))}
              {!turno.pendente && <Fontes fontes={turno.fontes} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
