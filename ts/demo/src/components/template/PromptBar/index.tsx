// Barra "Pergunte ao seu Repositório" — portada do Oracle/Confi (a barra de
// prompt de public/index.html + app.js). Substitui a busca no header do oracle.
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
import { EVENTO_ESCUTA, getEscutaAtiva, getTtsAtivo } from "@/utils/oraclePrefs";
import { falar, pararFala } from "@/utils/falar";
import { useWakeWord } from "./useWakeWord";
import type { OrigemPedido } from "@/services/api/orquestrador";
import { pararDesktopApi } from "@/services/api/desktop";
import { decidirEnvio } from "@/services/api/desktop-comandos";
import { useLocation, useNavigate } from "react-router";
import { detectarIntencao } from "@/app/pages/ceo/resumo-matinal/intencao";
import {
  EVENTO_RESPOSTA_FALADA,
  briefingAtivo,
  contextoDoBriefing,
  pedirBriefing,
} from "@/app/pages/ceo/resumo-matinal/sessao";

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

/** Bipe curto de "ouvindo" ao detectar a palavra de ativação. */
function bipe() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio: o aviso visual basta */
  }
}

// ----------------------------------------------------------------------

export function PromptBar() {
  const { t, i18n } = useTranslation();
  const { perguntar, loading, expandido, status: statusAssistente } = useAssistente();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Padrão: a IA decide a fonte (memória ou web). "Repositório" e "Web" ficam
  // como escolha explícita de quem quer forçar uma delas.
  const [modo, setModo] = useState<ModoBusca>("auto");
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
  // Ditado aberto pela palavra de ativação: ao terminar, envia sozinho.
  const ditadoPorPalavraRef = useRef(false);
  /** O texto atual do campo veio do ditado (vale para a resposta falada). */
  const textoPorVozRef = useRef(false);
  /** Limite de tempo do ditado aberto pela palavra de ativação. */
  const ditadoLimiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ditadoTextoRef = useRef("");

  // --- Ativação por voz (Configurações › Voz) ---
  const [escuta, setEscuta] = useState(getEscutaAtiva);
  useEffect(() => {
    const atualizar = (e: Event) =>
      setEscuta(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EVENTO_ESCUTA, atualizar);
    return () => window.removeEventListener(EVENTO_ESCUTA, atualizar);
  }, []);

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
      if (ditadoLimiteRef.current) clearTimeout(ditadoLimiteRef.current);
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
    // Clicar no microfone também cala a resposta falada.
    pararFala();
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    iniciarDitado(false);
  };

  /**
   * Abre o ditado. `porPalavra`: veio da palavra de ativação — o texto ditado
   * substitui o campo e é enviado sozinho quando a pessoa para de falar.
   */
  const iniciarDitado = (porPalavra: boolean) => {
    pararFala();
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
        textoPorVozRef.current = true;
        if (ditadoPorPalavraRef.current) {
          ditadoTextoRef.current = (
            ditadoTextoRef.current +
            " " +
            final.trim()
          ).trim();
          setValue(ditadoTextoRef.current);
          // A pergunta terminou: fecha o microfone do ditado já. Só uma nova
          // palavra de ativação abre outro.
          rec.stop();
        } else {
          setValue((v) => (v ? v.trimEnd() + " " : "") + final.trim());
        }
        flashStatus("");
      } else if (interim) {
        flashStatus("🎙 " + interim);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      if (ditadoLimiteRef.current) {
        clearTimeout(ditadoLimiteRef.current);
        ditadoLimiteRef.current = null;
      }
      setListening(false);
      recognitionRef.current = null;
      setStatus((s) => (s.msg.startsWith("🎙") ? { msg: "", cls: "" } : s));
      inputRef.current?.focus();
      if (ditadoPorPalavraRef.current) {
        ditadoPorPalavraRef.current = false;
        const texto = ditadoTextoRef.current.trim();
        ditadoTextoRef.current = "";
        // Veio da palavra de ativação: o servidor trata ações no computador
        // com mais cautela (SR-06b), porque áudio de terceiros também ativa.
        if (texto) void enviar(texto, "voz_ativacao");
        else flashStatus("Não ouvi a pergunta. Diga a palavra de novo.", "", true);
      }
    };
    ditadoPorPalavraRef.current = porPalavra;
    ditadoTextoRef.current = "";
    if (porPalavra) {
      setValue("");
      flashStatus("🎙 Ouvindo… pode perguntar");
    }
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
    // Segurança: o ditado aberto pela palavra nunca fica aberto indefinidamente.
    if (porPalavra) {
      ditadoLimiteRef.current = setTimeout(() => rec.stop(), 15000);
    }
  };

  const wake = useWakeWord({
    ativo: escuta,
    // Pausa enquanto o ditado do navegador usa o microfone. Continua ativa
    // durante a busca para "Oracle, pare tudo" funcionar no meio de uma
    // execução (GB-03); outros pedidos ditados nessa hora são ignorados.
    pausado: listening,
    onDetect: () => {
      if (recognitionRef.current) return;
      bipe();
      iniciarDitado(true);
    },
  });

  // Fechar o painel do assistente interrompe a resposta falada.
  useEffect(() => {
    if (statusAssistente === "closed") pararFala();
  }, [statusAssistente]);

  // Avisa uma vez quando a ativação por voz falha (chave, arquivos, permissão).
  useEffect(() => {
    if (wake.estado === "erro" && wake.erro) toast.error(wake.erro);
  }, [wake.estado, wake.erro]);

  // --- Enviar (pergunta de topo: abre o painel do assistente) ---
  // A conversa em si (e o follow-up) vive no contexto do assistente; aqui só
  // coletamos a pergunta e refletimos o resultado na linha de status da barra.
  const enviar = async (textoDitado?: string, origemDitado?: OrigemPedido) => {
    const texto = (textoDitado ?? value).trim();
    // "Oracle, pare tudo" passa ANTES do bloqueio de `loading` (GB-03): é
    // justamente durante uma execução que a pessoa precisa parar.
    const decisao = decidirEnvio(texto, loading);
    if (decisao === "ignorar") return;
    if (listening) recognitionRef.current?.stop();
    pararFala();
    const porVoz = textoDitado !== undefined || textoPorVozRef.current;
    const origem: OrigemPedido = origemDitado ?? (porVoz ? "voz" : "texto");
    textoPorVozRef.current = false;

    // Interrompe as ações no computador na hora, sem passar pela IA (SR-31).
    if (decisao === "parar") {
      setValue("");
      flashStatus("⏹ parando tudo…");
      try {
        const r = await pararDesktopApi();
        flashStatus(`⏹ tudo parado (${r.dispositivos} computador(es))`, "ok", true);
      } catch {
        flashStatus("✕ não consegui parar pelo servidor — use \"Parar tudo\" na bandeja", "err");
      }
      return;
    }

    // "Oracle, bom dia" (e variações): abre o Resumo Matinal em vez de
    // virar uma pergunta comum. Por voz, o briefing também é falado.
    const intencao = detectarIntencao(texto, { briefingAtivo: briefingAtivo() });
    if (intencao) {
      setValue("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      const naPagina = pathname.endsWith("/resumo-matinal");
      if (intencao.tipo === "continuar") {
        pedirBriefing({ acao: "continuar" });
      } else if (naPagina) {
        pedirBriefing({ acao: "iniciar", periodo: intencao.periodo, ouvir: porVoz });
      } else {
        const produto = pathname.split("/").filter(Boolean)[0] || "oracle";
        navigate(
          `/${produto}/resumo-matinal?periodo=${intencao.periodo}${porVoz ? "&ouvir=1" : ""}`,
        );
      }
      flashStatus("☀ abrindo o Resumo Matinal", "ok", true);
      return;
    }
    // Pergunta durante o briefing: vai com o briefing como contexto.
    const contextoBriefing = contextoDoBriefing();

    const usarAnexo = arquivo && modo !== "web";
    flashStatus(usarAnexo ? "lendo anexo e buscando…" : ROTULO[modo]);

    const r = await perguntar({
      texto,
      modo,
      arquivo: modo !== "web" ? arquivo : null,
      ...(contextoBriefing ? { contexto: contextoBriefing } : {}),
      origem,
    });

    if (!r.ok) {
      flashStatus("✕ " + (r.erro || t("chrome.searchError")), "err");
      return;
    }

    setValue("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    limparAnexo();
    // Resposta falada: só para perguntas feitas por voz (Configurações › Voz).
    // Avisa o Resumo Matinal quando a resposta terminou (oferece continuar).
    const avisarFim = () => {
      if (contextoBriefing) window.dispatchEvent(new Event(EVENTO_RESPOSTA_FALADA));
    };
    if (porVoz && r.resposta && getTtsAtivo()) {
      void falar(r.resposta, {
        idioma: i18n.language?.startsWith("en") ? "en-US" : "pt-BR",
        onFim: avisarFim,
      });
    } else {
      avisarFim();
    }
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
            title={
              listening
                ? "Parar ditado"
                : wake.estado === "escutando"
                  ? `Ditar por voz · ou diga “${wake.rotulo}”`
                  : wake.estado === "carregando"
                    ? "Ditar por voz · preparando a ativação por voz…"
                    : wake.estado === "erro"
                      ? `Ditar por voz · ativação por voz indisponível: ${wake.erro}`
                      : "Ditar por voz"
            }
            className={clsx(
              "relative grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
              listening
                ? "from-primary-600 to-primary-400 animate-pulse bg-gradient-to-br text-white"
                : "bg-primary-500/10 text-primary-600 dark:text-primary-400 dark:hover:bg-primary-400/20 hover:bg-primary-500/20",
            )}
          >
            <MicrophoneIcon className="size-4" />
            {/* Indicador da ativação por voz: o microfone está aberto,
                esperando a palavra (detecção local). */}
            {!listening && wake.estado !== "desligado" && (
              <span
                aria-hidden
                className={clsx(
                  "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-white dark:ring-dark-700",
                  wake.estado === "escutando" && "animate-pulse bg-emerald-500",
                  wake.estado === "carregando" && "bg-amber-400",
                  wake.estado === "pausado" && "bg-gray-400",
                  wake.estado === "erro" && "bg-red-500",
                )}
              />
            )}
          </button>
          <MemoriaTextarea
            ref={inputRef}
            rows={1}
            value={value}
            placeholder={t("chrome.promptPlaceholder")}
            onChange={(e) => {
              textoPorVozRef.current = false;
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            className="dark:text-dark-100 dark:placeholder:text-dark-300 h-7 max-h-7 min-w-0 flex-1 resize-none self-center bg-transparent px-1 py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => void enviar()}
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
