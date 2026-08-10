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
  FilmIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea, MemoriaInput } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import {
  getVideoConfig,
  gerarRoteiroVideoApi,
  getAvatares,
  getVozes,
  gerarVideoApi,
  getVideoStatusApi,
  type Avatar,
  type Voz,
} from "@/services/api/video";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar vídeo (IA · HeyGen) — portado do beculture/Confi. Roteiro (opcional via
// IA) → avatar + voz → gera na nuvem HeyGen → poll → MP4. Requer HEYGEN_API_KEY
// no servidor.
// ----------------------------------------------------------------------

const FORMATOS = ["16:9", "9:16", "1:1", "4:5"];

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar o vídeo. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function VideoModal({ isOpen, close, onMinimize }: Props) {
  const [config, setConfig] = useState<{ configurado: boolean } | null>(null);
  const [avatares, setAvatares] = useState<Avatar[]>([]);
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [loadErro, setLoadErro] = useState("");

  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [script, setScript] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [formato, setFormato] = useState("16:9");
  const [speed, setSpeed] = useState(1);
  const [usarFundo, setUsarFundo] = useState(false);
  const [fundo, setFundo] = useState("#0b1220");
  const [teste, setTeste] = useState(true);

  const [gerandoRoteiro, setGerandoRoteiro] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [erro, setErro] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  const pollRef = useRef<number | null>(null);
  const stopPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  // Carrega config + avatares/vozes ao abrir.
  useEffect(() => {
    if (!isOpen) return;
    let vivo = true;
    (async () => {
      try {
        const c = await getVideoConfig();
        if (!vivo) return;
        setConfig(c);
        if (c.configurado) {
          const [av, vz] = await Promise.all([getAvatares(), getVozes()]);
          if (!vivo) return;
          setAvatares(av);
          setVozes(vz);
          if (av[0]) setAvatarId((id) => id || av[0].id);
          if (vz[0]) setVoiceId((id) => id || vz[0].id);
        }
      } catch (err) {
        if (vivo) setLoadErro(errMessage(err));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [isOpen]);

  const escreverComIA = async () => {
    if (!tema.trim()) {
      setErro("Descreva o assunto do vídeo para a IA escrever o roteiro.");
      return;
    }
    setErro("");
    setGerandoRoteiro(true);
    try {
      const s = await gerarRoteiroVideoApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        design,
      });
      setScript(s);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setGerandoRoteiro(false);
    }
  };

  const startPoll = (videoId: string) => {
    stopPoll();
    setStatusText("Na fila do HeyGen…");
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await getVideoStatusApi(videoId);
        if (s.status === "completed" && s.url) {
          stopPoll();
          setResultUrl(s.url);
          setGerando(false);
          toast("Vídeo pronto", { description: "Seu MP4 foi gerado no HeyGen." });
        } else if (s.status === "failed") {
          stopPoll();
          setErro(s.erro || "O HeyGen falhou ao gerar o vídeo.");
          setGerando(false);
        } else {
          setStatusText(s.status === "processing" ? "Renderizando no HeyGen…" : `Status: ${s.status}`);
        }
      } catch (err) {
        stopPoll();
        setErro(errMessage(err));
        setGerando(false);
      }
    }, 5000);
  };

  const gerar = async () => {
    setErro("");
    setResultUrl("");
    if (!script.trim()) return setErro("Escreva (ou gere) o texto que o avatar vai falar.");
    if (!avatarId) return setErro("Escolha um avatar.");
    if (!voiceId) return setErro("Escolha uma voz.");
    setGerando(true);
    setStatusText("Enviando ao HeyGen…");
    try {
      const { videoId } = await gerarVideoApi({
        script: script.trim(),
        avatarId,
        voiceId,
        formato,
        speed,
        fundo: usarFundo ? fundo : undefined,
        titulo: tema.trim() || undefined,
        teste,
        design,
      });
      startPoll(videoId);
    } catch (err) {
      setErro(errMessage(err));
      setGerando(false);
    }
  };

  const fechar = () => {
    if (gerando) return;
    stopPoll();
    close();
  };

  const novo = () => {
    setResultUrl("");
    setErro("");
    setStatusText("");
  };

  // O MP4 fica no CDN do HeyGen: tentamos baixá-lo para a pasta do Repositório e,
  // se o CORS barrar, a nota guarda o roteiro + o link (que expira em dias).
  const prepararMemoria = async () => {
    const base = `**Roteiro**\n\n${script.trim()}`;
    try {
      const r = await fetch(resultUrl);
      if (!r.ok) throw new Error("download");
      return { conteudo: base, anexos: [{ nome: "video.mp4", dados: await r.blob() }] };
    } catch {
      return { conteudo: `${base}\n\n[Abrir o vídeo no HeyGen](${resultUrl})` };
    }
  };

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
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <FilmIcon className="size-5" />
                  IA · Criar vídeo <span className="dark:text-dark-300 text-xs font-normal text-gray-400">· HeyGen</span>
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={gerando}
                />
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                {config === null ? (
                  <div className="grid place-items-center py-10"><Spinner className="size-6" /></div>
                ) : !config.configurado ? (
                  <div className="dark:border-dark-600 rounded-xl border border-dashed border-gray-300 p-6 text-center">
                    <FilmIcon className="mx-auto size-8 text-gray-400" />
                    <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">HeyGen não configurado</p>
                    <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-400">
                      Defina <span className="font-mono">HEYGEN_API_KEY</span> no servidor (ts/api) para gerar vídeos com avatar falante.
                    </p>
                  </div>
                ) : resultUrl ? (
                  <div className="flex flex-col gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={resultUrl} controls className="max-h-[52vh] w-full rounded-xl bg-black" />
                    <div className="flex gap-2">
                      <Button component="a" href={resultUrl} target="_blank" rel="noreferrer" color="primary" className="gap-2">
                        <ArrowTopRightOnSquareIcon className="size-5" /> Abrir / baixar MP4
                      </Button>
                      <SalvarNaMemoriaButton
                        pasta={PASTA_MEMORIA.video}
                        titulo={tema.trim() || "Vídeo com avatar"}
                        tags={["vídeo"]}
                        versao={resultUrl}
                        preparar={prepararMemoria}
                        className="h-auto"
                      />
                      <EnviarParaGrupoButton
                        funcao="video"
                        titulo={tema.trim() || "Vídeo com avatar"}
                        versao={resultUrl}
                        preparar={prepararMemoria}
                        className="h-auto"
                      />
                      <Button variant="outlined" onClick={novo}>Novo vídeo</Button>
                    </div>
                    {teste && (
                      <p className="dark:text-dark-300 text-xs text-gray-400">
                        Modo teste: o vídeo tem marca d’água do HeyGen. Desmarque “Modo teste” para gastar créditos e gerar sem marca.
                      </p>
                    )}
                  </div>
                ) : gerando ? (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">{statusText || "Processando…"}</p>
                      <p className="dark:text-dark-300 text-xs text-gray-400">Vídeos de avatar podem levar de 1 a alguns minutos.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <DesignSystemBar />

                    {loadErro && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs-plus text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                        {loadErro}
                      </div>
                    )}

                    {/* Roteiro */}
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <MemoriaInput
                          value={tema}
                          onChange={(e) => setTema(e.target.value)}
                          placeholder="Assunto do vídeo (para a IA escrever o roteiro)"
                          className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                        />
                        <Button onClick={escreverComIA} variant="outlined" disabled={gerandoRoteiro || !tema.trim()} className="gap-1.5">
                          {gerandoRoteiro ? <Spinner className="size-4" /> : <SparklesIcon className="size-4" />}
                          Escrever com IA
                        </Button>
                      </div>
                      <MemoriaInput
                        value={contexto}
                        onChange={(e) => setContexto(e.target.value)}
                        placeholder="Contexto p/ a IA (opcional): público, tom, o que não pode faltar…"
                        className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                      <MemoriaTextarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        rows={5}
                        placeholder="Texto que o avatar vai falar (digite ou gere com a IA acima)…"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>

                    {/* Avatares */}
                    <div>
                      <label className="dark:text-dark-200 mb-1.5 block text-xs-plus font-medium text-gray-600">Avatar ({avatares.length})</label>
                      {avatares.length === 0 ? (
                        <p className="dark:text-dark-300 text-xs text-gray-400">Nenhum avatar disponível na conta.</p>
                      ) : (
                        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                          {avatares.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setAvatarId(a.id)}
                              className={clsx(
                                "relative overflow-hidden rounded-lg border-2 transition-colors",
                                avatarId === a.id ? "border-primary-500" : "dark:border-dark-600 border-transparent hover:border-gray-300",
                              )}
                              title={a.nome}
                            >
                              {a.preview ? (
                                <img src={a.preview} alt={a.nome} className="aspect-square w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="dark:bg-dark-600 grid aspect-square w-full place-items-center bg-gray-100 text-tiny text-gray-400">{a.nome.slice(0, 12)}</div>
                              )}
                              {avatarId === a.id && (
                                <span className="absolute right-1 top-1 text-primary-500">
                                  <CheckCircleIcon className="size-5" />
                                </span>
                              )}
                              <span className="dark:bg-dark-800/80 dark:text-dark-100 absolute inset-x-0 bottom-0 truncate bg-white/80 px-1 py-0.5 text-tiny text-gray-700">{a.nome}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Voz + formato + velocidade */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Voz</label>
                        <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm">
                          {vozes.map((v) => <option key={v.id} value={v.id}>{v.nome} {v.idioma ? `· ${v.idioma}` : ""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Formato</label>
                        <select value={formato} onChange={(e) => setFormato(e.target.value)} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm">
                          {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Velocidade: {speed}×</label>
                        <input type="range" min={0.5} max={1.5} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-2 w-full accent-primary-600" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                        <Checkbox checked={usarFundo} onChange={(e) => setUsarFundo(e.target.checked)} className="size-4" />
                        Cor de fundo
                      </label>
                      {usarFundo && <input type="color" value={fundo} onChange={(e) => setFundo(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-gray-300 dark:border-dark-500" />}
                      <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                        <Checkbox checked={teste} onChange={(e) => setTeste(e.target.checked)} className="size-4" />
                        Modo teste <span className="text-gray-400">(marca d’água, sem gastar créditos)</span>
                      </label>
                    </div>

                    {erro && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        {erro}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={gerar} color="primary" disabled={!script.trim() || !avatarId || !voiceId} className="gap-2">
                        <FilmIcon className="size-5" /> Gerar vídeo
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
