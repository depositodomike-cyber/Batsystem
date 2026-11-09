// Import Dependencies
import { useEffect, useRef, useState } from "react";
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
import { Accordion, Button } from "@/components/ui";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
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
import {
  AcoesEtapa,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_SELECT,
  LabCarregando,
  LabEtapa,
  LabResultado,
  PerguntaEtapa,
  ROTULO_CAMPO,
  useEtapasLab,
} from "./lab";

type EtapaCorte = "video" | "trechos" | "acabamento";
const ETAPAS_CORTE = [
  { id: "video" as const, numero: "01", titulo: "Vídeo" },
  { id: "trechos" as const, numero: "02", titulo: "Trechos" },
  { id: "acabamento" as const, numero: "03", titulo: "Formato e acabamento" },
];

// ----------------------------------------------------------------------
// Criar cortes — editor de vídeo no navegador (ffmpeg.wasm). Portado do
// Oracle/Confi (que usa ffmpeg local). Upload → recorta trechos → formato,
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

  const [fase, setFase] = useState<"idle" | "carregando" | "renderizando">(
    "idle",
  );
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const exporting = fase !== "idle";

  // Limpa object URLs ao trocar/fechar.
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );

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
    setTrechos((t) =>
      [...t, { inicio, fim }].sort((a, b) => a.inicio - b.inicio),
    );
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
  // recupera para gravar o arquivo na pasta do Repositório.
  const prepararMemoria = async () => {
    const dados = await (await fetch(resultUrl)).blob();
    const segs = trechos.length ? trechos : [{ inicio: 0, fim: duration }];
    const resumo = segs
      .map((s) => `- ${fmt(s.inicio)} → ${fmt(s.fim)}`)
      .join("\n");
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

  const etapas = useEtapasLab<EtapaCorte>(ETAPAS_CORTE, {
    video: file ? `${file.name} · ${fmt(duration)}` : undefined,
    trechos: trechos.length
      ? `${trechos.length} ${trechos.length === 1 ? "trecho" : "trechos"}`
      : "Vídeo inteiro",
    acabamento: `${ASPECTOS.find(([id]) => id === aspecto)?.[1] ?? aspecto} · ${velocidade}× · volume ${Math.round(volume * 100)}%`,
  });

  return (
    <IaModalShell
      isOpen={isOpen}
      close={fechar}
      onMinimize={onMinimize}
      closeDisabled={exporting}
      title={
        <>
          Lab · Criar cortes
          <span className="dark:bg-dark-600 dark:text-dark-200 ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            no navegador
          </span>
        </>
      }
      icon={VideoCameraIcon}
      size="4xl"
    >
      {/* Etapas no mesmo padrão das páginas do Lab. Continua janela: a
          exportação roda no navegador (ffmpeg.wasm) e segue ao minimizar. */}
      {exporting ? (
        <LabCarregando
          semCard
          titulo={
            fase === "carregando"
              ? "Carregando o editor de vídeo…"
              : `Renderizando… ${Math.round(progresso * 100)}%`
          }
          descricao="O corte é processado no seu navegador. Você pode minimizar a janela."
        >
          <div className="mt-2 w-full max-w-sm">
            <div className="dark:bg-dark-500 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="bg-primary-500 h-full rounded-lg transition-[width]"
                style={{
                  width:
                    fase === "carregando"
                      ? "15%"
                      : `${Math.round(progresso * 100)}%`,
                }}
              />
            </div>
          </div>
        </LabCarregando>
      ) : resultUrl ? (
        <LabResultado
          semCard
          titulo="Corte pronto"
          descricao={tituloCorte}
          detalhe={`${trechos.length || 1} ${trechos.length > 1 ? "trechos" : "trecho"} · ${
            ASPECTOS.find(([id]) => id === aspecto)?.[1] ?? aspecto
          } · ${velocidade}×`}
          erro={erro}
          acoesSecundarias={
            <>
              <Button
                variant="flat"
                onClick={() => setResultUrl("")}
                className="gap-1.5"
              >
                <ArrowPathIcon className="size-4" /> Novo corte
              </Button>
              <Button
                variant="flat"
                onClick={() => {
                  setResultUrl("");
                  setFile(null);
                  setUrl("");
                  etapas.reiniciar();
                }}
                className="gap-1.5"
              >
                <ArrowUpTrayIcon className="size-4" /> Trocar vídeo
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.cortes}
                titulo={tituloCorte}
                tags={["corte", "vídeo"]}
                versao={resultUrl}
                preparar={prepararMemoria}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="cortes"
                titulo={tituloCorte}
                versao={resultUrl}
                preparar={prepararMemoria}
                className="h-10 px-5"
              />
              <Button
                onClick={baixar}
                color="primary"
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" /> Baixar MP4
              </Button>
            </>
          }
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={resultUrl}
            controls
            className="max-h-[48vh] w-full rounded-xl bg-black"
          />
        </LabResultado>
      ) : (
        <div>
          <Accordion {...etapas.accordion} className="flex flex-col gap-3">
            <LabEtapa {...etapas.etapa("video")}>
              <PerguntaEtapa>Qual vídeo você quer cortar?</PerguntaEtapa>
              {file ? (
                <div className="dark:border-dark-600 dark:bg-dark-800/40 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
                  <VideoCameraIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                  <span className="dark:text-dark-100 text-xs-plus min-w-0 flex-1 truncate text-gray-700">
                    {file.name} · {fmt(duration)}
                  </span>
                  <Button
                    variant="flat"
                    onClick={() => {
                      setFile(null);
                      setUrl("");
                    }}
                    className="h-8 gap-1.5 px-2.5 text-xs"
                  >
                    <ArrowUpTrayIcon className="size-4" /> Trocar vídeo
                  </Button>
                </div>
              ) : (
                <label className="dark:border-dark-450 dark:hover:border-dark-400 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 px-10 py-10 text-center hover:border-gray-400">
                  <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-14 place-items-center rounded-2xl">
                    <ArrowUpTrayIcon className="size-7" />
                  </span>
                  <span className="dark:text-dark-100 text-sm font-medium text-gray-700">
                    Carregar um vídeo
                  </span>
                  <span className="dark:text-dark-300 text-xs text-gray-400">
                    MP4, MOV, WebM… processado no seu navegador
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      escolher(f);
                      if (f) etapas.concluirEtapa("video");
                    }}
                  />
                </label>
              )}
              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              {file && (
                <AcoesEtapa onContinuar={() => etapas.concluirEtapa("video")} />
              )}
            </LabEtapa>

            <LabEtapa
              {...etapas.etapa("trechos")}
              pendenteLabel={file ? "Opcional" : "Carregue um vídeo primeiro"}
            >
              {file ? (
                <div className="flex flex-col gap-3">
                  <PerguntaEtapa className="">
                    Quais trechos entram no corte?
                  </PerguntaEtapa>
                  <div className="border-dark-600 overflow-hidden rounded-xl border bg-black">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      ref={videoRef}
                      src={url}
                      className="max-h-[42vh] w-full bg-black"
                      onLoadedMetadata={onMeta}
                      onTimeUpdate={() =>
                        setCur(videoRef.current?.currentTime ?? 0)
                      }
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={togglePlay}
                      variant="outlined"
                      isIcon
                      className="size-9 rounded-lg"
                    >
                      {playing ? (
                        <PauseIcon className="size-5" />
                      ) : (
                        <PlayIcon className="size-5" />
                      )}
                    </Button>
                    <span className="dark:text-dark-200 text-xs text-gray-500 tabular-nums">
                      {fmt(cur)} / {fmt(duration)}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div
                    className="dark:bg-dark-500 relative h-8 w-full cursor-pointer rounded-lg bg-gray-200"
                    onClick={seekFromClick}
                  >
                    {trechos.map((t, i) => (
                      <div
                        key={i}
                        className="bg-primary-500/50 absolute inset-y-1 rounded"
                        style={{
                          left: pct(t.inicio),
                          width: pct(t.fim - t.inicio),
                        }}
                      />
                    ))}
                    <div
                      className="border-primary-500 bg-primary-500/20 absolute inset-y-0 rounded border"
                      style={{
                        left: pct(inicio),
                        width: pct(Math.max(0, fim - inicio)),
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-rose-500"
                      style={{ left: pct(cur) }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => setInicio(cur)}
                      variant="outlined"
                      className="text-xs-plus h-8 gap-1.5 px-2.5"
                    >
                      Início: {fmt(inicio)}
                    </Button>
                    <Button
                      onClick={() => setFim(cur)}
                      variant="outlined"
                      className="text-xs-plus h-8 gap-1.5 px-2.5"
                    >
                      Fim: {fmt(fim)}
                    </Button>
                    <Button
                      onClick={adicionarTrecho}
                      color="primary"
                      className="text-xs-plus h-8 gap-1.5 px-2.5"
                    >
                      <ScissorsIcon className="size-4" /> Adicionar trecho
                    </Button>
                  </div>

                  {trechos.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {trechos.map((t, i) => (
                        <li
                          key={i}
                          className="dark:border-dark-600 text-xs-plus flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5"
                        >
                          <span className="dark:text-dark-200 text-gray-600">
                            Trecho {i + 1}: {fmt(t.inicio)} → {fmt(t.fim)}{" "}
                            <span className="text-gray-400">
                              ({fmt(t.fim - t.inicio)})
                            </span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => seek(t.inicio)}
                              className="dark:hover:bg-dark-600 rounded px-2 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              ir
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTrechos((x) => x.filter((_, k) => k !== i))
                              }
                              aria-label="Remover"
                              className="grid size-6 place-items-center rounded text-gray-400 hover:text-rose-500"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="dark:text-dark-300 text-xs text-gray-500">
                    Sem trechos, o vídeo inteiro é exportado. Marque Início e
                    Fim com o playhead e clique em “Adicionar trecho”.
                  </p>
                  <AcoesEtapa
                    onContinuar={() => etapas.concluirEtapa("trechos")}
                  />
                </div>
              ) : (
                <p className="dark:text-dark-300 text-sm text-gray-500">
                  Carregue um vídeo na etapa anterior.
                </p>
              )}
            </LabEtapa>

            <LabEtapa {...etapas.etapa("acabamento")}>
              <PerguntaEtapa>Formato e acabamento</PerguntaEtapa>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={ROTULO_CAMPO}>Formato</label>
                  <select
                    value={aspecto}
                    onChange={(e) => setAspecto(e.target.value as Aspecto)}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    {ASPECTOS.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={ROTULO_CAMPO}>Velocidade</label>
                  <select
                    value={velocidade}
                    onChange={(e) => setVelocidade(Number(e.target.value))}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    {VELOCIDADES.map((v) => (
                      <option key={v} value={v}>
                        {v}×
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Volume: {Math.round(volume * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="accent-primary-600 w-full"
                />
              </div>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Texto{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (opcional)
                  </span>
                </label>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Legenda ou chamada sobre o vídeo"
                  className={`${CAMPO} rounded-lg`}
                />
                {texto.trim() && (
                  <div className="mt-2 flex gap-1.5">
                    {POSICOES.map(([id, nome]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTextoPos(id)}
                        className={clsx(
                          "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                          textoPos === id
                            ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                            : "dark:border-dark-450 dark:text-dark-200 border-gray-300 text-gray-500",
                        )}
                      >
                        {nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("acabamento")}
              />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => void exportar()}
              color="primary"
              disabled={!file}
              className="h-10 gap-2 px-5"
            >
              <ScissorsIcon className="size-5" /> Exportar corte
            </Button>
          </div>
        </div>
      )}
    </IaModalShell>
  );
}
