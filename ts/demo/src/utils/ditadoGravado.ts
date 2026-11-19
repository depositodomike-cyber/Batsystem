/**
 * Ditado por voz no Oracle Desktop.
 *
 * O reconhecimento de fala do navegador (Web Speech `SpeechRecognition`)
 * depende de um serviço do Google que o Electron não tem. Esta classe imita a
 * parte da interface que o Oracle usa (lang, continuous, onresult, onerror,
 * onend, start, stop): grava o trecho falado com o MediaRecorder, encerra
 * sozinha no silêncio (como o ditado do navegador com `continuous = false`) e
 * transcreve em `POST /ai/audio/transcrever` (Whisper, mesma chave OpenAI do
 * resto do Oracle). O resultado chega como um único resultado final.
 *
 * Só é usada quando `ehDesktop()`; no navegador nada muda.
 */
import { toast } from "sonner";
import axios from "./axios";

type Alternativa = { transcript: string; confidence: number };
type ResultadoFinal = ArrayLike<Alternativa> & { isFinal: boolean };
type EventoResultado = { resultIndex: number; results: ArrayLike<ResultadoFinal> };
type EventoErro = { error: string; message?: string };

/** Nível (RMS) a partir do qual o som conta como fala. */
const LIMIAR_FALA = 0.015;
/** Silêncio depois de falar que encerra a gravação. */
const SILENCIO_FIM_MS = 1500;
/** Sem fala nenhuma desde o início: desiste. */
const SEM_FALA_MS = 8000;
/** Teto de uma gravação. */
const MAXIMO_MS = 30000;

function mensagemDeErro(err: unknown): string {
  const dados = (err as { response?: { data?: { message?: unknown } } })?.response?.data;
  const m = dados?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m) && typeof m[0] === "string") return m[0];
  return "Não foi possível transcrever o áudio.";
}

export class ReconhecimentoGravado {
  lang = "pt-BR";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: EventoResultado) => void) | null = null;
  onerror: ((e: EventoErro) => void) | null = null;
  onend: (() => void) | null = null;

  private stream: MediaStream | null = null;
  private gravador: MediaRecorder | null = null;
  private partes: Blob[] = [];
  private ctx: AudioContext | null = null;
  private vigia: number | null = null;
  private limite: number | null = null;
  private encerrado = false;

  start(): void {
    void this.iniciar();
  }

  stop(): void {
    if (this.gravador?.state === "recording") this.gravador.stop();
    else if (!this.gravador) this.fim();
  }

  private async iniciar(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const nome = (err as { name?: string })?.name;
      this.onerror?.({ error: nome === "NotAllowedError" ? "not-allowed" : "audio-capture" });
      this.fim();
      return;
    }
    const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    this.gravador = new MediaRecorder(this.stream, tipo ? { mimeType: tipo } : undefined);
    this.gravador.ondataavailable = (e) => {
      if (e.data.size > 0) this.partes.push(e.data);
    };
    this.gravador.onstop = () => void this.transcrever();
    this.gravador.start(250);
    this.vigiarSilencio(this.stream);
    this.limite = window.setTimeout(() => this.stop(), MAXIMO_MS);
  }

  private vigiarSilencio(stream: MediaStream): void {
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analisador);
      const amostras = new Float32Array(analisador.fftSize);
      const inicio = performance.now();
      let falou = false;
      let ultimaFala = inicio;
      this.vigia = window.setInterval(() => {
        analisador.getFloatTimeDomainData(amostras);
        let soma = 0;
        for (const v of amostras) soma += v * v;
        const agora = performance.now();
        if (Math.sqrt(soma / amostras.length) > LIMIAR_FALA) {
          falou = true;
          ultimaFala = agora;
        }
        if (this.continuous) return;
        if (
          (falou && agora - ultimaFala > SILENCIO_FIM_MS) ||
          (!falou && agora - inicio > SEM_FALA_MS)
        ) {
          this.stop();
        }
      }, 100);
    } catch {
      // Sem análise de nível: encerra pelo teto ou pelo clique em parar.
    }
  }

  private liberar(): void {
    if (this.vigia !== null) window.clearInterval(this.vigia);
    if (this.limite !== null) window.clearTimeout(this.limite);
    this.vigia = this.limite = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private async transcrever(): Promise<void> {
    this.liberar();
    const blob = new Blob(this.partes, { type: this.gravador?.mimeType || "audio/webm" });
    this.partes = [];
    if (blob.size === 0) {
      this.fim();
      return;
    }
    const form = new FormData();
    form.append("audio", blob, "ditado.webm");
    form.append("idioma", this.lang.toLowerCase().startsWith("en") ? "en" : "pt");
    try {
      const { data } = await axios.post<{ texto?: string }>("/ai/audio/transcrever", form);
      const texto = (data?.texto ?? "").trim();
      if (texto) {
        const final = Object.assign([{ transcript: texto, confidence: 1 }], {
          isFinal: true,
        });
        this.onresult?.({ resultIndex: 0, results: [final] });
      }
    } catch (err) {
      const message = mensagemDeErro(err);
      toast.error(message);
      this.onerror?.({ error: "network", message });
    }
    this.fim();
  }

  private fim(): void {
    if (this.encerrado) return;
    this.encerrado = true;
    this.liberar();
    this.onend?.();
  }
}
