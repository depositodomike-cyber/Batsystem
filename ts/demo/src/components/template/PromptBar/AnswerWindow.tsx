// Janela flutuante de resposta do Prompt — portada do beculture/Confi
// (criarJanela/renderConversa em public/app.js). Mostra a conversa (pergunta +
// resposta em Markdown), os chips de fontes e um campo para continuar a conversa.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import {
  XMarkIcon,
  MinusIcon,
  ArrowUpIcon,
  GlobeAltIcon,
  CircleStackIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import { fonteLabel, fonteUrl, type Fonte } from "@/services/api/prompt";

// ----------------------------------------------------------------------

export interface Turno {
  pergunta: string;
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
  pendente?: boolean;
}

interface AnswerWindowProps {
  conversa: Turno[];
  origem: "vault" | "web";
  loading: boolean;
  minimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  onFollowUp: (texto: string) => void;
}

// ----------------------------------------------------------------------

function Fontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {fontes.map((f, i) => {
        const url = fonteUrl(f);
        const label = fonteLabel(f);
        const base =
          "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-tiny";
        if (url) {
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              title={url}
              className={clsx(
                base,
                "dark:border-dark-500 dark:text-dark-200 dark:hover:border-dark-400 border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              <ArrowTopRightOnSquareIcon className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </a>
          );
        }
        return (
          <span
            key={i}
            title={label}
            className={clsx(
              base,
              "border-primary-500/25 text-primary-600 dark:text-primary-400 bg-primary-500/5",
            )}
          >
            <CircleStackIcon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------

export function AnswerWindow({
  conversa,
  origem,
  loading,
  minimized,
  onToggleMinimize,
  onClose,
  onFollowUp,
}: AnswerWindowProps) {
  const [followUp, setFollowUp] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const titulo = conversa[0]?.pergunta?.trim() || "Resposta";

  // Rola para o fim quando chega novo conteúdo.
  useEffect(() => {
    if (!minimized && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [conversa, loading, minimized]);

  const enviar = () => {
    const t = followUp.trim();
    if (!t || loading) return;
    onFollowUp(t);
    setFollowUp("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  if (minimized) {
    return createPortal(
      <button
        onClick={onToggleMinimize}
        className="dark:bg-dark-700 dark:border-dark-500 fixed right-4 bottom-4 z-[110] flex max-w-xs items-center gap-2 rounded-full border border-gray-200 bg-white py-2 pr-3 pl-2 shadow-lg"
      >
        <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-7 shrink-0 place-items-center rounded-full">
          {origem === "web" ? (
            <GlobeAltIcon className="size-4" />
          ) : (
            <CircleStackIcon className="size-4" />
          )}
        </span>
        <span className="dark:text-dark-100 truncate text-xs font-medium text-gray-700">
          {titulo}
        </span>
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-x-0 top-[76px] z-[110] flex justify-center px-4">
      <div className="dark:bg-dark-700 dark:border-dark-500 flex max-h-[76vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="dark:border-dark-600 flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
          <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-7 shrink-0 place-items-center rounded-full">
            {origem === "web" ? (
              <GlobeAltIcon className="size-4" />
            ) : (
              <CircleStackIcon className="size-4" />
            )}
          </span>
          <p
            title={titulo}
            className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm font-medium text-gray-700"
          >
            {titulo}
          </p>
          <button
            onClick={onToggleMinimize}
            title="Minimizar"
            className="dark:text-dark-300 dark:hover:bg-dark-500/40 grid size-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <MinusIcon className="size-4" />
          </button>
          <button
            onClick={onClose}
            title="Fechar"
            className="dark:text-dark-300 dark:hover:bg-dark-500/40 grid size-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>

        {/* Conversa */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {conversa.map((t, i) => (
            <div key={i} className={clsx(i > 0 && "dark:border-dark-600 mt-4 border-t border-gray-100 pt-4")}>
              <p className="text-primary-600 dark:text-primary-400 text-sm font-semibold">
                {t.pergunta}
              </p>
              <div className="mt-1.5">
                {t.pendente ? (
                  <p className="dark:text-dark-300 flex items-center gap-2 text-sm text-gray-400">
                    <span className="border-primary-500 size-3 animate-spin rounded-full border-2 border-t-transparent" />
                    pensando…
                  </p>
                ) : (
                  <MarkdownView>{t.resposta}</MarkdownView>
                )}
              </div>
              {!t.pendente && <Fontes fontes={t.fontes} />}
            </div>
          ))}
        </div>

        {/* Continuar a conversa */}
        <div className="dark:border-dark-600 dark:bg-dark-800/40 border-t border-gray-100 bg-gray-50/60 p-2.5">
          <div className="dark:border-dark-500 dark:bg-dark-700 focus-within:border-primary-500/60 flex items-end gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
            <MemoriaTextarea
              ref={inputRef}
              rows={1}
              value={followUp}
              disabled={loading}
              placeholder={origem === "web" ? "Continuar na web…" : "Continuar perguntando…"}
              onChange={(e) => {
                setFollowUp(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              className="dark:text-dark-100 max-h-[120px] flex-1 resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={enviar}
              disabled={loading || !followUp.trim()}
              title="Enviar"
              className="from-primary-600 to-primary-400 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
