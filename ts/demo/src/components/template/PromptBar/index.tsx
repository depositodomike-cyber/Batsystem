// Barra "Pergunte ao seu Repositório" — portada do beculture/Confi (a barra de
// prompt de public/index.html + app.js). Substitui a busca no header do behuman.
// Seletor de fonte (Memória/Web/Auto), anexo de texto, ditado por voz (Web
// Speech API) e envio ao assistente — a resposta aparece no painel da bolinha,
// no canto inferior direito (ver src/components/template/Assistente).
import { useEffect, useRef, useState } from "react";
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

import { type ModoBusca } from "@/services/api/prompt";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { useTranslation } from "react-i18next";
import { useAssistente } from "@/app/contexts/assistente/context";

// ----------------------------------------------------------------------

const ACEITA_ANEXO = ".txt,.md,.csv,.json,.log,.markdown,text/*";

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
  const { perguntar, loading, expandido } = useAssistente();
  const [modo, setModo] = useState<ModoBusca>("vault");
  const [value, setValue] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState<{ msg: string; cls: "" | "ok" | "err" }>({
    msg: "",
    cls: "",
  });
  const [listening, setListening] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  //
  // Só focamos se a barra estiver realmente visível: abaixo de `lg` o header a
  // esconde por CSS e mostra a lupa no lugar, e `offsetParent === null` é o
  // jeito de perguntar isso ao próprio CSS — usar os breakpoints em JS aqui
  // divergiria da media query, porque eles medem `window.innerWidth`.
  const focarBarra = () => {
    const el = inputRef.current;
    if (el && el.offsetParent !== null) el.focus();
  };

  // Desligados com o assistente ampliado: focar esta barra jogaria o cursor
  // atrás do backdrop. `mod+k` tem enableOnFormTags, então dispararia até de
  // dentro do textarea do painel.
  useHotkeys("mod+k", focarBarra, {
    enableOnFormTags: true,
    preventDefault: true,
    enabled: !expandido,
  });
  useHotkeys("/", focarBarra, {
    preventDefault: true,
    enabled: !expandido,
  });

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
      recognitionRef.current?.stop();
    };
  }, []);

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

  // --- Enviar (pergunta de topo: abre o painel do assistente) ---
  // A conversa em si (e o follow-up) vive no contexto do assistente; aqui só
  // coletamos a pergunta e refletimos o resultado na linha de status da barra.
  const enviar = async () => {
    const texto = value.trim();
    if (!texto || loading) return;
    if (listening) recognitionRef.current?.stop();

    const usarAnexo = arquivo && modo !== "web";
    flashStatus(usarAnexo ? "lendo anexo e buscando…" : ROTULO[modo]);

    const r = await perguntar({
      texto,
      modo,
      arquivo: modo !== "web" ? arquivo : null,
    });

    if (!r.ok) {
      flashStatus("✕ " + (r.erro || t("chrome.searchError")), "err");
      return;
    }

    setValue("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    limparAnexo();
    flashStatus(
      r.origem === "web" ? "↗ respondido via web" : "◈ respondido pelo Repositório",
      "ok",
      true,
    );
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

      {/* Chip do anexo e linha de status, empilhados abaixo da barra. Antes o
          chip ficava em -top-8, dentro de um header sticky de 65px — ou seja,
          acima do viewport e nunca visível. */}
      {(arquivo || status.msg) && (
        <div className="absolute top-full left-0 mt-1 flex max-w-full flex-col items-start gap-1">
          {arquivo && (
            <div className="dark:border-dark-500 dark:bg-dark-700 flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 shadow-sm">
              <PaperClipIcon className="text-primary-500 size-3.5 shrink-0" />
              <span className="text-primary-600 dark:text-primary-400 max-w-[240px] truncate text-tiny">
                {arquivo.name}
              </span>
              <button
                onClick={limparAnexo}
                title="Remover anexo"
                className="dark:text-dark-300 shrink-0 text-gray-400 hover:text-red-500"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </div>
          )}

          {status.msg && (
            <div
              className={clsx(
                "max-w-full truncate text-tiny",
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
        </div>
      )}
    </div>
  );
}
