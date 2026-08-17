// Barra "Pergunte ao seu Repositório" — portada do beculture/Confi (a barra de
// prompt de public/index.html + app.js). Substitui a busca no header do behuman.
// Seletor de fonte (Memória/Web/Auto), anexo de texto, ditado por voz (Web
// Speech API), envio ao backend /ai/prompt e resposta em janela flutuante.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  PlusIcon,
  MicrophoneIcon,
  ArrowUpIcon,
  XMarkIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import clsx from "clsx";

import { perguntarPromptApi, type ModoBusca } from "@/services/api/prompt";
import { coletarReferencia } from "@/services/referencia";
import { marcarBuscaMemoria } from "@/utils/memoriaBusca";
import { AnswerWindow, type Turno } from "./AnswerWindow";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { useTranslation } from "react-i18next";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";

// ----------------------------------------------------------------------

const ACEITA_ANEXO = ".txt,.md,.csv,.json,.log,.markdown,text/*";

function msgErro(e: unknown, fallback: string): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return String(m[0]);
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

// Tipo mínimo da Web Speech API (não faz parte do lib DOM padrão).
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ----------------------------------------------------------------------

export function PromptBar() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const { refresh } = useConversasContext();
  const repositorioId = useRepositorioAtivo()?.id ?? undefined;
  const [modo, setModo] = useState<ModoBusca>("vault");
  const [value, setValue] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ msg: string; cls: "" | "ok" | "err" }>({
    msg: "",
    cls: "",
  });
  const [listening, setListening] = useState(false);

  const [conversa, setConversa] = useState<Turno[] | null>(null);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [modoConversa, setModoConversa] = useState<ModoBusca>("vault");
  const [winOpen, setWinOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const origem = conversa?.[0]?.origem ?? "vault";

  const MODOS: { id: ModoBusca; label: string; title: string }[] = [
    {
      id: "vault",
      label: t("chrome.modeMemory"),
      title: t("chrome.modeMemoryTitle"),
    },
    {
      id: "web",
      label: t("chrome.modeWeb"),
      title: t("chrome.modeWebTitle"),
    },
    {
      id: "auto",
      label: t("chrome.modeAuto"),
      title: t("chrome.modeAutoTitle"),
    },
  ];

  const ROTULO: Record<ModoBusca, string> = {
    vault: t("chrome.searchingMemory"),
    web: t("chrome.searchingWeb"),
    auto: t("chrome.routing"),
  };

  // ⌘K / "/" foca a barra (herda o atalho da antiga busca).
  useHotkeys("mod+k", () => inputRef.current?.focus(), {
    enableOnFormTags: true,
    preventDefault: true,
  });
  useHotkeys("/", () => inputRef.current?.focus(), {
    preventDefault: true,
  });

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
      recognitionRef.current?.stop();
    };
  }, []);

  // Troca de repositório/organização: a janela e o id pertencem ao contexto anterior.
  useEffect(() => {
    setConversa(null);
    setConversaId(null);
    setWinOpen(false);
    setMinimized(false);
  }, [repositorioId]);

  const flashStatus = (msg: string, cls: "" | "ok" | "err" = "", auto = false) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus({ msg, cls });
    if (auto) {
      statusTimer.current = setTimeout(() => setStatus({ msg: "", cls: "" }), 4000);
    }
  };

  const limparAnexo = () => {
    setArquivo(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // --- Ditado por voz (Web Speech API) ---
  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Ditado por voz não é suportado neste navegador.");
      return;
    }
    const rec = new Ctor();
    rec.lang = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript ?? "";
        if (r.isFinal) final += txt;
        else interim += txt;
      }
      if (final) {
        setValue((v) => (v ? v.trimEnd() + " " : "") + final.trim());
        flashStatus("");
      } else if (interim) {
        flashStatus("🎙 " + interim);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setStatus((s) => (s.msg.startsWith("🎙") ? { msg: "", cls: "" } : s));
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  // --- Enviar (pergunta de topo: abre a janela) ---
  const enviar = async () => {
    const texto = value.trim();
    if (!texto || loading) return;
    if (listening) recognitionRef.current?.stop();

    setLoading(true);
    const usarAnexo = arquivo && modo !== "web";
    flashStatus(usarAnexo ? "lendo anexo e buscando…" : ROTULO[modo]);
    // Busca que toca o Repositório faz o grafo "pensar" enquanto a resposta não vem.
    const animaGrafo = modo !== "web";
    if (animaGrafo) marcarBuscaMemoria(true);
    try {
      // Referência (Notas/To-do) só faz sentido no cruzamento com o Repositório;
      // no modo Web o anexo/contexto local é ignorado (igual ao Confi).
      const referencia = modo !== "web" ? coletarReferencia() : undefined;
      const r = await perguntarPromptApi({
        texto,
        modo,
        arquivo: modo !== "web" ? arquivo : null,
        referencia,
        repositorioId,
      });
      setModoConversa(modo);
      setConversaId(r.conversaId ?? null);
      setConversa([
        {
          pergunta: texto,
          resposta: r.resposta,
          fontes: r.fontes,
          origem: r.origem,
        },
      ]);
      setWinOpen(true);
      setMinimized(false);
      setValue("");
      void refresh();
      if (r.conversaId) {
        window.setTimeout(() => void refresh(), 2500);
      }
      if (inputRef.current) inputRef.current.style.height = "auto";
      limparAnexo();
      flashStatus(
        r.origem === "web" ? "↗ respondido via web" : "◈ respondido pelo Repositório",
        "ok",
        true,
      );
    } catch (e) {
      flashStatus("✕ " + msgErro(e, t("chrome.searchError")), "err");
    } finally {
      if (animaGrafo) marcarBuscaMemoria(false);
      setLoading(false);
    }
  };

  // --- Continuar a conversa dentro da janela ---
  const continuar = async (texto: string) => {
    if (!conversa || loading) return;
    const historico = conversa.map((t) => ({
      pergunta: t.pergunta,
      resposta: t.resposta,
    }));
    const pendente: Turno = {
      pergunta: texto,
      resposta: "",
      fontes: [],
      origem,
      pendente: true,
    };
    setConversa([...conversa, pendente]);
    setLoading(true);
    const animaGrafo = modoConversa !== "web";
    if (animaGrafo) marcarBuscaMemoria(true);
    try {
      const referencia =
        modoConversa !== "web" ? coletarReferencia() : undefined;
      const r = await perguntarPromptApi({
        texto,
        modo: modoConversa,
        historico,
        conversaId: conversaId ?? undefined,
        referencia,
        repositorioId,
      });
      if (r.conversaId) setConversaId(r.conversaId);
      void refresh();
      setConversa((c) =>
        (c ?? []).map((t) =>
          t === pendente
            ? {
                pergunta: texto,
                resposta: r.resposta,
                fontes: r.fontes,
                origem: r.origem,
              }
            : t,
        ),
      );
    } catch (e) {
      const msg = "✕ " + msgErro(e, t("chrome.searchError"));
      setConversa((c) =>
        (c ?? []).map((t) =>
          t === pendente ? { ...t, resposta: msg, pendente: false } : t,
        ),
      );
    } finally {
      if (animaGrafo) marcarBuscaMemoria(false);
      setLoading(false);
    }
  };

  const fecharJanela = () => {
    setWinOpen(false);
    setConversa(null);
    setConversaId(null);
  };

  return (
    <div className="relative w-full">
      <input
        ref={fileRef}
        type="file"
        accept={ACEITA_ANEXO}
        hidden
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
      />

      {/* Chip do anexo (acima da barra) */}
      {arquivo && (
        <div className="dark:border-dark-500 dark:bg-dark-700 absolute -top-8 left-0 flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 shadow-sm">
          <PaperClipIcon className="text-primary-500 size-3.5 shrink-0" />
          <span className="text-primary-600 dark:text-primary-400 max-w-[240px] truncate text-tiny">
            {arquivo.name}
          </span>
          <button
            onClick={limparAnexo}
            title="Remover anexo"
            className="dark:text-dark-300 text-gray-400 hover:text-red-500"
          >
            <XMarkIcon className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-stretch">
        {/* Seletor de fonte (texto horizontal, grudado à barra) */}
        <div className="dark:border-dark-500 dark:bg-dark-700 flex shrink-0 overflow-hidden rounded-l-lg border border-r-0 border-gray-200 bg-gray-100/70">
          {MODOS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModo(m.id)}
              title={m.title}
              className={clsx(
                "flex items-center justify-center px-2 text-[11px] font-medium tracking-wide transition-colors",
                i > 0 && "dark:border-dark-500 border-l border-gray-200",
                modo === m.id
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                  : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-400 hover:text-gray-600",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Barra de busca */}
        <div className="dark:border-dark-500 dark:bg-dark-700 focus-within:border-primary-500/60 flex min-w-0 flex-1 items-end gap-1 rounded-r-lg border border-gray-200 bg-gray-100/70 px-1.5 py-1 transition-colors">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Anexar arquivo à pergunta"
            className="bg-primary-500/10 text-primary-600 dark:text-primary-400 dark:hover:bg-primary-400/20 hover:bg-primary-500/20 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
          >
            <PlusIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleMic}
            title={listening ? "Parar ditado" : "Ditar por voz"}
            className={clsx(
              "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
              listening
                ? "from-primary-600 to-primary-400 animate-pulse bg-gradient-to-br text-white"
                : "bg-primary-500/10 text-primary-600 dark:text-primary-400 dark:hover:bg-primary-400/20 hover:bg-primary-500/20",
            )}
          >
            <MicrophoneIcon className="size-4" />
          </button>
          <MemoriaTextarea
            ref={inputRef}
            rows={1}
            value={value}
            placeholder={t("chrome.promptPlaceholder")}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            className="dark:text-dark-100 dark:placeholder:text-dark-300 h-7 max-h-7 min-w-0 flex-1 resize-none self-center bg-transparent px-1 py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={loading || !value.trim()}
            title="Buscar"
            className="from-primary-600 to-primary-400 grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white transition-opacity disabled:opacity-40"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Linha de status */}
      {status.msg && (
        <div
          className={clsx(
            "absolute top-full left-0 mt-1 max-w-full truncate text-tiny",
            status.cls === "err"
              ? "text-red-500"
              : status.cls === "ok"
                ? "text-emerald-500"
                : "text-primary-600 dark:text-primary-400",
          )}
        >
          {status.msg}
        </div>
      )}

      {winOpen && conversa && (
        <AnswerWindow
          conversa={conversa}
          origem={origem}
          loading={loading}
          minimized={minimized}
          continuarHref={
            conversaId
              ? `/${product.code}/conversas/${conversaId}`
              : undefined
          }
          onToggleMinimize={() => setMinimized((m) => !m)}
          onClose={fecharJanela}
          onFollowUp={continuar}
        />
      )}
    </div>
  );
}
