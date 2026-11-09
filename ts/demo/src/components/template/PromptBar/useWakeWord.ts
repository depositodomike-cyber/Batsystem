import { useEffect, useRef, useState } from "react";

import { WAKE_WORD } from "@/configs/wakeWord";

// ----------------------------------------------------------------------
// Escuta local da palavra de ativação (Vosk, WebAssembly, código aberto).
//
// Só a DETECÇÃO roda aqui, e ela é 100% local: os quadros de áudio vão do
// microfone para o worker do Vosk e morrem ali. O reconhecedor é criado com
// uma gramática restrita (as palavras de ativação + "[unk]"), então tudo que
// não for a palavra cai em "desconhecido". Quando a palavra é ouvida, o hook
// chama `onDetect` — quem decide o que fazer (abrir o ditado) é a tela.
//
// Regra rigorosa: só aciona quando a FALA INTEIRA é a palavra de ativação
// (dita sozinha, seguida de uma pausa), sem nenhum "[unk]" e com confiança
// alta em cada palavra. "Oracle, qual é…" numa frase só não aciona.
//
// A biblioteca e o modelo são carregados sob demanda: quem nunca liga a
// ativação por voz não baixa nada.
// ----------------------------------------------------------------------

export type EstadoEscuta =
  | "desligado"
  | "carregando"
  | "escutando"
  | "pausado"
  | "erro";

/** Ao retomar depois do ditado/busca, ignora este tanto de áudio. */
const GUARDA_APOS_RETOMAR_MS = 1500;
/** Se o ditado não chegar a abrir depois de uma detecção, libera após isto. */
const LIBERA_SEM_CICLO_MS = 5000;

type PalavraVosk = { word: string; conf: number };

/** Mensagem legível para as falhas mais comuns da configuração. */
function mensagemDeErro(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/permission|notallowed|denied/i.test(msg))
    return "O navegador não liberou o microfone. Permita o acesso e tente de novo.";
  if (/modelo-ausente/.test(msg))
    return `Não encontrei o modelo de voz em ts/demo/public${WAKE_WORD.modeloPath}. Veja docs/ativacao-por-voz.md.`;
  if (/notfound|no audio|device/i.test(msg))
    return "Nenhum microfone encontrado.";
  return msg || "Falha ao iniciar a ativação por voz.";
}

/** O Vite devolve o index.html (200) para caminhos inexistentes: checa o tipo. */
async function modeloExiste(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const tipo = r.headers.get("content-type") ?? "";
    return r.ok && !tipo.includes("text/html");
  } catch {
    return false;
  }
}

/** A fala inteira é só a palavra de ativação, com confiança suficiente? */
function falaEhSoAPalavra(palavras: PalavraVosk[] | undefined): boolean {
  if (!palavras?.length || palavras.length > 2) return false;
  return palavras.every(
    (p) =>
      WAKE_WORD.palavras.includes(p.word.toLowerCase()) &&
      p.conf >= WAKE_WORD.confianca,
  );
}

type Reconhecedor = {
  acceptWaveform: (buffer: AudioBuffer) => void;
  remove: () => void;
};

type Motor = {
  ctx: AudioContext;
  stream: MediaStream;
  desligar: () => void;
};

export function useWakeWord({
  ativo,
  pausado,
  onDetect,
}: {
  /** Preferência ligada (Configurações › Voz). */
  ativo: boolean;
  /** Pausa a escuta sem descarregar o motor (ex.: durante o ditado). */
  pausado: boolean;
  onDetect: () => void;
}) {
  // Estado do motor enquanto ligado. "Desligado" e "pausado" são derivados
  // (abaixo), e não gravados num efeito.
  const [estado, setEstado] = useState<EstadoEscuta>("carregando");
  const [erro, setErro] = useState("");
  const motorRef = useRef<Motor | null>(null);
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  // Depois de uma detecção, nada é aceito até o ciclo ditado → busca terminar
  // (pausado vai a true e volta a false). Evita reabrir o ditado sozinho.
  const aguardandoCicloRef = useRef(false);
  const viuPausaRef = useRef(false);
  const liberaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardaAteRef = useRef(0);

  // Carrega/descarrega o motor conforme a preferência.
  useEffect(() => {
    if (!ativo) return;

    let vivo = true;
    const falhar = (e: unknown) => {
      if (!vivo) return;
      setEstado("erro");
      setErro(mensagemDeErro(e));
    };

    (async () => {
      try {
        const url = new URL(WAKE_WORD.modeloPath, window.location.origin).href;
        if (!(await modeloExiste(url))) throw new Error("modelo-ausente");

        const { createModel } = await import("vosk-browser");
        const model = await createModel(url);
        if (!vivo) {
          model.terminate();
          return;
        }
        model.on("error", (m) => falhar("error" in m ? m.error : m));

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          model.terminate();
          return;
        }

        const ctx = new AudioContext();
        const gramatica = JSON.stringify([...WAKE_WORD.palavras, "[unk]"]);
        let reconhecedor: Reconhecedor | null = null;

        const detectou = () => {
          aguardandoCicloRef.current = true;
          viuPausaRef.current = false;
          if (liberaTimerRef.current) clearTimeout(liberaTimerRef.current);
          // Se o ditado nem chegou a abrir, não fica travado para sempre.
          liberaTimerRef.current = setTimeout(() => {
            if (!viuPausaRef.current) aguardandoCicloRef.current = false;
          }, LIBERA_SEM_CICLO_MS);
          // Reconhecedor novo: nada desta fala sobra para a retomada.
          criarReconhecedor();
          onDetectRef.current();
        };

        // Um reconhecedor por "rodada": recriado a cada detecção.
        const criarReconhecedor = () => {
          reconhecedor?.remove();
          const r = new model.KaldiRecognizer(ctx.sampleRate, gramatica);
          r.setWords(true);
          // Só o resultado FINAL (depois da pausa na fala) conta.
          r.on("result", (m) => {
            if (r !== reconhecedor) return;
            if (!("result" in m) || !("text" in m.result)) return;
            if (pausadoRef.current || aguardandoCicloRef.current) return;
            if (falaEhSoAPalavra(m.result.result)) detectou();
          });
          reconhecedor = r;
        };
        criarReconhecedor();

        const fonte = ctx.createMediaStreamSource(stream);
        // ScriptProcessor é obsoleto, mas é o que o vosk-browser espera
        // (AudioBuffer) e funciona em todos os navegadores.
        const processador = ctx.createScriptProcessor(4096, 1, 1);
        processador.onaudioprocess = (ev) => {
          if (
            pausadoRef.current ||
            aguardandoCicloRef.current ||
            Date.now() < guardaAteRef.current
          )
            return;
          try {
            reconhecedor?.acceptWaveform(ev.inputBuffer);
          } catch (e) {
            falhar(e);
          }
        };
        fonte.connect(processador);
        processador.connect(ctx.destination);

        motorRef.current = {
          ctx,
          stream,
          desligar: () => {
            processador.onaudioprocess = null;
            fonte.disconnect();
            processador.disconnect();
            stream.getTracks().forEach((t) => t.stop());
            void ctx.close();
            reconhecedor?.remove();
            reconhecedor = null;
            model.terminate();
          },
        };
        // "Pausado" é derivado da prop no retorno; aqui basta "pronto".
        if (vivo) setEstado("escutando");
      } catch (e) {
        falhar(e);
      }
    })();

    return () => {
      vivo = false;
      // Próxima ativação começa de "carregando", sem erro antigo.
      setEstado("carregando");
      setErro("");
      if (liberaTimerRef.current) clearTimeout(liberaTimerRef.current);
      aguardandoCicloRef.current = false;
      motorRef.current?.desligar();
      motorRef.current = null;
    };
  }, [ativo]);

  // Pausa/retoma sem descarregar o modelo: o ditado do navegador usa o mesmo
  // microfone, então a trilha é desligada enquanto ele fala.
  useEffect(() => {
    if (pausado) {
      if (aguardandoCicloRef.current) viuPausaRef.current = true;
    } else {
      // Fim do ciclo ditado → busca: volta a aceitar, depois de uma guarda.
      if (aguardandoCicloRef.current && viuPausaRef.current) {
        aguardandoCicloRef.current = false;
        viuPausaRef.current = false;
      }
      guardaAteRef.current = Date.now() + GUARDA_APOS_RETOMAR_MS;
    }
    const m = motorRef.current;
    if (!m || estado !== "escutando") return;
    m.stream.getAudioTracks().forEach((t) => (t.enabled = !pausado));
    void (pausado ? m.ctx.suspend() : m.ctx.resume());
  }, [pausado, estado]);

  return {
    estado: (!ativo
      ? "desligado"
      : estado === "escutando" && pausado
        ? "pausado"
        : estado) as EstadoEscuta,
    erro: ativo ? erro : "",
    rotulo: WAKE_WORD.rotulo,
  };
}
