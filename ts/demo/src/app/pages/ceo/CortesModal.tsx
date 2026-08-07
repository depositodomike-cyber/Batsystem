// Import Dependencies
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  VideoCameraIcon,
  ArrowUpTrayIcon,
  PlayIcon,
  PauseIcon,
  ScissorsIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar } from "./design-system";
import {
  carregarFfmpeg,
  exportarCorte,
  dimensoesSaida,
  type Aspecto,
  type Segmento,
  type TextoPos,
} from "@/services/ffmpegCortes";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar cortes — editor de vídeo no navegador (ffmpeg.wasm). Portado do
// beculture/Confi (que usa ffmpeg local). Upload → recorta trechos → formato,
// velocidade, volume e texto → exporta MP4. Tudo client-side.
// ----------------------------------------------------------------------

const ASPECTOS: [Aspecto, string][] = [
  ["original", "Original"],
  ["9:16", "9:16 (vertical)"],
  ["1:1", "1:1 (quadrado)"],
  ["16:9", "16:9 (horizontal)"],
];
const VELOCIDADES = [0.5, 1, 1.5, 2];
const POSICOES: [TextoPos, string][] = [
  ["top", "Topo"],
  ["center", "Centro"],
  ["bottom", "Base"],
];

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${seg.toString().padStart(2, "0")}.${ms}`;
}

function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Falha ao exportar o vídeo. Tente um trecho menor.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function CortesModal({ isOpen, close, onMinimize }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [inicio, setInicio] = useState(0);
  const [fim, setFim] = useState(0);
  const [trechos, setTrechos] = useState<Segmento[]>([]);

  const [aspecto, setAspecto] = useState<Aspecto>("original");
  const [velocidade, setVelocidade] = useState(1);
  const [volume, setVolume] = useState(1);
  const [texto, setTexto] = useState("");
  const [textoPos, setTextoPos] = useState<TextoPos>("bottom");

  const [fase, setFase] = useState<"idle" | "carregando" | "renderizando">("idle");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const exporting = fase !== "idle";

  // Limpa object URLs ao trocar/fechar.
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = velocidade;
  }, [velocidade, url]);

  const escolher = (f: File | null) => {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setTrechos([]);
    setResultUrl("");
    setErro("");
    setCur(0);
    setInicio(0);
    setFim(0);
  };

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    setDims({ w: v.videoWidth, h: v.videoHeight });
    setFim(v.duration || 0);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
  };

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * duration);
  };

  const adicionarTrecho = () => {
    if (fim - inicio < 0.1) {
      setErro("O trecho precisa ter início e fim válidos.");
      return;
    }
    setErro("");
    setTrechos((t) => [...t, { inicio, fim }].sort((a, b) => a.inicio - b.inicio));
  };

  const exportar = async () => {
    if (!file) return;
    setErro("");
    setResultUrl("");
    const segmentos = trechos.length ? trechos : [{ inicio: 0, fim: duration }];
    const { ow, oh } = dimensoesSaida(aspecto, dims.w, dims.h);
    try {
      setFase("carregando");
      setProgresso(0);
      await carregarFfmpeg();
      setFase("renderizando");
      const blob = await exportarCorte({
        file,
        segmentos,
        ow,
        oh,
        velocidade,
        volume,
        texto: texto.trim() || undefined,
        textoPos,
        onProgress: (p) => setProgresso(p),
      });
      setResultUrl(URL.createObjectURL(blob));
      toast("Corte pronto", { description: "Seu MP4 foi gerado." });
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setFase("idle");
    }
  };

  const tituloCorte = `Corte — ${(file?.name || "vídeo").replace(/\.[^.]+$/, "")}`;

  const baixar = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `corte-${(file?.name || "video").replace(/\.[^.]+$/, "")}.mp4`;
    a.click();
  };

  // O MP4 já está no navegador (blob: URL do ffmpeg.wasm) — o fetch só o
  // recupera para gravar o arquivo na pasta do Contexto.
  const prepararMemoria = async () => {
    const dados = await (await fetch(resultUrl)).blob();
    const segs = trechos.length ? trechos : [{ inicio: 0, fim: duration }];
    const resumo = segs.map((s) => `- ${fmt(s.inicio)} → ${fmt(s.fim)}`).join("\n");
    return {
      conteudo: `Corte gerado a partir de **${file?.name ?? "vídeo"}** (${aspecto}, ${velocidade}×).\n\n**Trechos**\n${resumo}`,
      anexos: [{ nome: "corte.mp4", dados }],
    };
  };

  const fechar = () => {
    if (exporting) return;
    close();
  };

  const pct = (v: number) => (duration ? `${(v / duration) * 100}%` : "0%");

  return (
    <Transition show={isOpen}>
      <Dialog onClose={fechar} className="relative z-[70]">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <VideoCameraIcon className="size-5" />
                  IA · Criar cortes
                  <span className="dark:bg-dark-600 dark:text-dark-200 ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                    no navegador
                  </span>
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={exporting}
                />
              </div>

              <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
                <DesignSystemBar className="mb-4" />

                {!file ? (
                  /* Upload */
                  <div className="grid place-items-center py-10">
                    <label className="dark:border-dark-500 dark:hover:border-dark-400 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 px-10 py-12 text-center hover:border-gray-400">
                      <span className="grid size-14 place-items-center rounded-2xl bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
                        <ArrowUpTrayIcon className="size-7" />
                      </span>
                      <span className="dark:text-dark-100 text-sm font-medium text-gray-700">Carregar um vídeo</span>
                      <span className="dark:text-dark-300 text-xs text-gray-400">MP4, MOV, WebM… processado no seu navegador</span>
                      <input type="file" accept="video/*" hidden onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Player + timeline */}
                    <div className="flex flex-col gap-3">
                      <div className="overflow-hidden rounded-xl border border-dark-600 bg-black">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          ref={videoRef}
                          src={url}
                          className="max-h-[42vh] w-full bg-black"
                          onLoadedMetadata={onMeta}
                          onTimeUpdate={() => setCur(videoRef.current?.currentTime ?? 0)}
                          onPlay={() => setPlaying(true)}
                          onPause={() => setPlaying(false)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button onClick={togglePlay} variant="outlined" isIcon className="size-9 rounded-full">
                          {playing ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
                        </Button>
                        <span className="dark:text-dark-200 tabular-nums text-xs text-gray-500">
                          {fmt(cur)} / {fmt(duration)}
                        </span>
                      </div>

                      {/* Timeline */}
                      <div className="relative h-8 w-full cursor-pointer rounded-lg bg-gray-200 dark:bg-dark-500" onClick={seekFromClick}>
                        {/* trechos adicionados */}
                        {trechos.map((t, i) => (
                          <div key={i} className="absolute inset-y-1 rounded bg-primary-500/50" style={{ left: pct(t.inicio), width: pct(t.fim - t.inicio) }} />
                        ))}
                        {/* seleção atual */}
                        <div className="absolute inset-y-0 rounded border border-primary-500 bg-primary-500/20" style={{ left: pct(inicio), width: pct(Math.max(0, fim - inicio)) }} />
                        {/* playhead */}
                        <div className="absolute inset-y-0 w-0.5 bg-rose-500" style={{ left: pct(cur) }} />
                      </div>

                      {/* Seleção de trecho */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => setInicio(cur)} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          Início: {fmt(inicio)}
                        </Button>
                        <Button onClick={() => setFim(cur)} variant="outlined" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          Fim: {fmt(fim)}
                        </Button>
                        <Button onClick={adicionarTrecho} color="primary" className="h-8 gap-1.5 px-2.5 text-xs-plus">
                          <ScissorsIcon className="size-4" /> Adicionar trecho
                        </Button>
                      </div>

                      {trechos.length > 0 && (
                        <ul className="flex flex-col gap-1">
                          {trechos.map((t, i) => (
                            <li key={i} className="dark:border-dark-600 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-xs-plus">
                              <span className="dark:text-dark-200 text-gray-600">
                                Trecho {i + 1}: {fmt(t.inicio)} → {fmt(t.fim)} <span className="text-gray-400">({fmt(t.fim - t.inicio)})</span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => seek(t.inicio)} className="dark:hover:bg-dark-600 rounded px-2 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">ir</button>
                                <button type="button" onClick={() => setTrechos((x) => x.filter((_, k) => k !== i))} aria-label="Remover" className="grid size-6 place-items-center rounded text-gray-400 hover:text-rose-500">
                                  <TrashIcon className="size-4" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="dark:text-dark-300 text-tiny text-gray-400">
                        Sem trechos, o vídeo inteiro é exportado. Marque Início/Fim com o playhead e clique em “Adicionar trecho”.
                      </p>
                    </div>

                    {/* Controles + export */}
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Formato</label>
                          <select value={aspecto} onChange={(e) => setAspecto(e.target.value as Aspecto)} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                            {ASPECTOS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Velocidade</label>
                          <select value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                            {VELOCIDADES.map((v) => <option key={v} value={v}>{v}×</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                          Volume: {Math.round(volume * 100)}%
                        </label>
                        <input type="range" min={0} max={2} step={0.1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-primary-600" />
                      </div>

                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Texto <span className="text-gray-400">(opcional)</span></label>
                        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Legenda / chamada sobre o vídeo" className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400" />
                        {texto.trim() && (
                          <div className="mt-1.5 flex gap-1.5">
                            {POSICOES.map(([id, nome]) => (
                              <button key={id} type="button" onClick={() => setTextoPos(id)} className={clsx("rounded-full border px-2.5 py-0.5 text-xs transition-colors", textoPos === id ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400" : "dark:border-dark-500 dark:text-dark-200 border-gray-300 text-gray-500")}>
                                {nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Export / progresso / resultado */}
                      {exporting ? (
                        <div className="dark:border-dark-600 rounded-xl border border-gray-200 p-3">
                          <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-dark-200">
                            <Spinner className="size-4" />
                            {fase === "carregando" ? "Carregando o editor de vídeo…" : `Renderizando… ${Math.round(progresso * 100)}%`}
                          </div>
                          <div className="dark:bg-dark-500 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div className="bg-primary-600 dark:bg-primary-500 h-full rounded-full transition-[width]" style={{ width: fase === "carregando" ? "15%" : `${Math.round(progresso * 100)}%` }} />
                          </div>
                        </div>
                      ) : resultUrl ? (
                        <div className="dark:border-dark-600 flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video src={resultUrl} controls className="max-h-[30vh] w-full rounded-lg bg-black" />
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={baixar} color="primary" className="flex-1 gap-2">
                              <ArrowDownTrayIcon className="size-5" /> Baixar MP4
                            </Button>
                            <SalvarNaMemoriaButton
                              pasta={PASTA_MEMORIA.cortes}
                              titulo={tituloCorte}
                              tags={["corte", "vídeo"]}
                              versao={resultUrl}
                              preparar={prepararMemoria}
                              className="h-auto"
                            />
                            <EnviarParaGrupoButton
                              funcao="cortes"
                              titulo={tituloCorte}
                              versao={resultUrl}
                              preparar={prepararMemoria}
                              className="h-auto"
                            />
                            <Button onClick={() => setResultUrl("")} variant="outlined" className="gap-1.5">
                              <ArrowPathIcon className="size-4" /> Novo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button onClick={exportar} color="primary" className="gap-2">
                          <ScissorsIcon className="size-5" /> Exportar corte
                        </Button>
                      )}

                      {erro && <p className="text-xs-plus text-rose-500">{erro}</p>}

                      <button type="button" onClick={() => escolher(null)} className="hidden" />
                      <Button variant="flat" onClick={() => { setFile(null); setUrl(""); }} disabled={exporting} className="gap-1.5 self-start">
                        <ArrowUpTrayIcon className="size-4" /> Trocar vídeo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
