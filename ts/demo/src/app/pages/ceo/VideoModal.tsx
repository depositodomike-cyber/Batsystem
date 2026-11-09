// Import Dependencies
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FilmIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Accordion, Button, Checkbox, Spinner } from "@/components/ui";
import {
  MemoriaTextarea,
  MemoriaInput,
} from "@/components/shared/MemoriaMentions";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
import type { IaModalOpenPayload } from "@/app/contexts/ia-modals/context";
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
import {
  AcoesEtapa,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_SELECT,
  CAMPO_TEXTAREA,
  errMessage as errMessageLab,
  LabCarregando,
  LabEtapa,
  LabResultado,
  PerguntaEtapa,
  ROTULO_CAMPO,
  useCriacaoLab,
  useEtapasLab,
  type PassoLab,
} from "./lab";

// ----------------------------------------------------------------------
// Criar vídeo (Lab · HeyGen). Continua JANELA, de propósito: a renderização
// no HeyGen leva minutos e o acompanhamento (poll) segue rodando enquanto a
// pessoa navega ou minimiza. Dentro da janela, o mesmo padrão de etapas das
// páginas do Lab: Roteiro → Avatar e voz → Formato e acabamento → render →
// MP4. Salva em Minhas criações (inclusive o id da renderização, para retomar
// o acompanhamento ao reabrir). Requer HEYGEN_API_KEY no servidor.
// ----------------------------------------------------------------------

const FORMATOS = ["16:9", "9:16", "1:1", "4:5"];
const FALHA = "Falha ao gerar o vídeo. Tente novamente.";
const errMessage = (err: unknown) => errMessageLab(err, FALHA);

type EtapaId = "roteiro" | "avatar" | "formato";
const ETAPAS = [
  { id: "roteiro" as const, numero: "01", titulo: "Roteiro" },
  { id: "avatar" as const, numero: "02", titulo: "Avatar e voz" },
  { id: "formato" as const, numero: "03", titulo: "Formato e acabamento" },
];

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
  /** `{ criacao: id }` ao reabrir pela lista de Minhas criações. */
  payload?: IaModalOpenPayload;
}

/**
 * Reabrir a janela com OUTRA criação remonta o conteúdo (estado limpo e
 * retomada certa). Minimizar e restaurar não muda o payload, então não remonta.
 */
export function VideoModal(props: Props) {
  const criacaoId =
    typeof props.payload?.criacao === "string" ? props.payload.criacao : null;
  return <VideoJanela key={criacaoId ?? "nova"} {...props} criacaoId={criacaoId} />;
}

function VideoJanela({
  isOpen,
  close,
  onMinimize,
  criacaoId,
}: Props & { criacaoId: string | null }) {
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
  const [fundo, setFundo] = useState("#000000");
  const [teste, setTeste] = useState(true);

  const [gerandoRoteiro, setGerandoRoteiro] = useState(false);
  const [passo, setPasso] = useState<PassoLab>("form");
  const [statusText, setStatusText] = useState("");
  const [erro, setErro] = useState("");
  const [videoId, setVideoId] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const design = useActiveDesignSystem();
  const gerando = passo === "gerando";

  const avatarNome = avatares.find((a) => a.id === avatarId)?.nome;
  const vozNome = vozes.find((v) => v.id === voiceId)?.nome;
  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    roteiro: script.trim()
      ? `${script.trim().split(/\s+/).length} palavras`
      : undefined,
    avatar: [avatarNome, vozNome].filter(Boolean).join(" · ") || undefined,
    formato: [
      formato,
      `${speed}×`,
      usarFundo ? `fundo ${fundo}` : null,
      teste ? "modo teste" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  const pollRef = useRef<number | null>(null);
  const stopPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  const startPoll = (id: string) => {
    stopPoll();
    setStatusText("Na fila do HeyGen…");
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await getVideoStatusApi(id);
        if (s.status === "completed" && s.url) {
          stopPoll();
          setResultUrl(s.url);
          setPasso("pronta");
          toast("Vídeo pronto", {
            description: "Seu MP4 foi gerado no HeyGen.",
          });
        } else if (s.status === "failed") {
          stopPoll();
          setErro(s.erro || "O HeyGen falhou ao gerar o vídeo.");
          setVideoId("");
          setPasso("form");
        } else {
          setStatusText(
            s.status === "processing"
              ? "Renderizando no HeyGen…"
              : `Status: ${s.status}`,
          );
        }
      } catch (err) {
        stopPoll();
        setErro(errMessage(err));
        setPasso("form");
      }
    }, 5000);
  };

  const criacao = useCriacaoLab({
    tipo: "video",
    idInicial: criacaoId,
    passo,
    erro: Boolean(erro) && !resultUrl,
    relevante: tema.trim().length >= 20 || script.trim().length >= 20 || Boolean(videoId),
    titulo: tema.trim().slice(0, 80) || script.trim().slice(0, 60),
    dados: {
      tema,
      contexto,
      script,
      avatarId,
      voiceId,
      formato,
      speed,
      usarFundo,
      fundo,
      teste,
      videoId,
      resultUrl,
    },
    restaurar: (d) => {
      setTema(d.tema ?? "");
      setContexto(d.contexto ?? "");
      setScript(d.script ?? "");
      if (d.avatarId) setAvatarId(d.avatarId);
      if (d.voiceId) setVoiceId(d.voiceId);
      if (d.formato) setFormato(d.formato);
      if (typeof d.speed === "number") setSpeed(d.speed);
      setUsarFundo(Boolean(d.usarFundo));
      if (d.fundo) setFundo(d.fundo);
      setTeste(d.teste !== false);
      if (d.resultUrl) {
        setResultUrl(d.resultUrl);
        setPasso("pronta");
      } else if (d.videoId) {
        // Renderização em andamento quando a criação foi salva: retoma o poll.
        setVideoId(d.videoId);
        setPasso("gerando");
        startPoll(d.videoId);
      } else {
        etapas.resolverTodas();
      }
    },
  });

  // O id da renderização é um marco: grava na hora, para dar para retomar.
  useEffect(() => {
    if (videoId) void criacao.gravarJa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

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

  const gerar = async () => {
    setErro("");
    setResultUrl("");
    if (!script.trim())
      return setErro("Escreva (ou gere) o texto que o avatar vai falar.");
    if (!avatarId) return setErro("Escolha um avatar.");
    if (!voiceId) return setErro("Escolha uma voz.");
    setPasso("gerando");
    setStatusText("Enviando ao HeyGen…");
    try {
      const { videoId: id } = await gerarVideoApi({
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
      setVideoId(id);
      startPoll(id);
    } catch (err) {
      setErro(errMessage(err));
      setPasso("form");
    }
  };

  const fechar = () => {
    if (gerando) return;
    stopPoll();
    close();
  };

  const novo = () => {
    criacao.reiniciar();
    setResultUrl("");
    setVideoId("");
    setErro("");
    setStatusText("");
    setTema("");
    setContexto("");
    setScript("");
    setPasso("form");
    etapas.reiniciar();
  };

  // O MP4 fica no CDN do HeyGen: tentamos baixá-lo para a pasta do Repositório e,
  // se o CORS barrar, a nota guarda o roteiro + o link (que expira em dias).
  const prepararMemoria = async () => {
    const base = `**Roteiro**\n\n${script.trim()}`;
    try {
      const r = await fetch(resultUrl);
      if (!r.ok) throw new Error("download");
      return {
        conteudo: base,
        anexos: [{ nome: "video.mp4", dados: await r.blob() }],
      };
    } catch {
      return { conteudo: `${base}\n\n[Abrir o vídeo no HeyGen](${resultUrl})` };
    }
  };

  return (
    <IaModalShell
      isOpen={isOpen}
      close={fechar}
      onMinimize={onMinimize}
      closeDisabled={gerando}
      title={
        <>
          Lab · Criar vídeo{" "}
          <span className="dark:text-dark-300 text-xs font-normal text-gray-400">
            · HeyGen
          </span>
        </>
      }
      icon={FilmIcon}
      size="4xl"
    >
      <div>
        {config === null && !criacao.carregando ? (
          <div className="grid place-items-center py-10">
            <Spinner className="size-6" />
          </div>
        ) : config && !config.configurado ? (
          <div className="dark:border-dark-600 rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <FilmIcon className="mx-auto size-8 text-gray-400" />
            <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
              HeyGen não configurado
            </p>
            <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
              Defina <span className="font-mono">HEYGEN_API_KEY</span> no
              servidor (ts/api) para gerar vídeos com avatar falante.
            </p>
          </div>
        ) : passo === "pronta" && resultUrl ? (
          <LabResultado
            semCard
            titulo="Vídeo pronto"
            descricao={tema.trim() || undefined}
            detalhe={
              teste
                ? "Modo teste: o vídeo tem marca d’água do HeyGen. Desmarque “Modo teste” para gastar créditos e gerar sem marca."
                : undefined
            }
            acoesSecundarias={
              <Button variant="flat" onClick={novo} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Novo vídeo
              </Button>
            }
            acoesPrincipais={
              <>
                <SalvarNaMemoriaButton
                  pasta={PASTA_MEMORIA.video}
                  titulo={tema.trim() || "Vídeo com avatar"}
                  tags={["vídeo"]}
                  versao={resultUrl}
                  preparar={prepararMemoria}
                  rotulo="Salvar no Repositório"
                  rotuloSalvo="Salvo no Repositório"
                  semSeletorDePasta
                  className="h-10 px-5"
                />
                <EnviarParaGrupoButton
                  funcao="video"
                  titulo={tema.trim() || "Vídeo com avatar"}
                  versao={resultUrl}
                  preparar={prepararMemoria}
                  className="h-10 px-5"
                />
                <Button
                  component="a"
                  href={resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  color="primary"
                  className="h-10 gap-2 px-5"
                >
                  <ArrowTopRightOnSquareIcon className="size-5" /> Abrir /
                  baixar MP4
                </Button>
              </>
            }
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={resultUrl}
              controls
              className="max-h-[52vh] w-full rounded-xl bg-black"
            />
          </LabResultado>
        ) : gerando ? (
          <LabCarregando
            semCard
            titulo={statusText || "Processando…"}
            descricao="Vídeos de avatar podem levar de 1 a alguns minutos. Você pode minimizar a janela e continuar navegando."
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void gerar();
            }}
          >
            {loadErro && (
              <div className={`${CAIXA_ERRO} mb-3`}>{loadErro}</div>
            )}
            {criacao.erroAoCarregar && (
              <div className={`${CAIXA_ERRO} mb-3`}>
                {criacao.erroAoCarregar}
              </div>
            )}

            <Accordion {...etapas.accordion} className="flex flex-col gap-3">
              <LabEtapa {...etapas.etapa("roteiro")}>
                <PerguntaEtapa>O que o avatar vai falar?</PerguntaEtapa>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <MemoriaInput
                    value={tema}
                    onChange={(e) => setTema(e.target.value)}
                    placeholder="Assunto do vídeo (para a IA escrever o roteiro)"
                    className={`${CAMPO} rounded-lg`}
                  />
                  <Button
                    type="button"
                    onClick={() => void escreverComIA()}
                    variant="outlined"
                    disabled={gerandoRoteiro || !tema.trim()}
                    className="h-10 gap-1.5"
                  >
                    {gerandoRoteiro ? (
                      <Spinner className="size-4" />
                    ) : (
                      <SparklesIcon className="size-4" />
                    )}
                    Escrever com IA
                  </Button>
                </div>
                <MemoriaInput
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  placeholder="Contexto para a IA (opcional): público, tom, o que não pode faltar…"
                  className={`${CAMPO} mt-2 rounded-lg`}
                />
                <MemoriaTextarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={6}
                  placeholder="Texto que o avatar vai falar (digite ou gere com a IA acima)…"
                  className={`${CAMPO_TEXTAREA} mt-2 rounded-lg`}
                />
                <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                  <DesignSystemBar plain />
                </div>
                <AcoesEtapa
                  onContinuar={() => etapas.concluirEtapa("roteiro")}
                  desabilitado={!script.trim()}
                />
              </LabEtapa>

              <LabEtapa {...etapas.etapa("avatar")}>
                <PerguntaEtapa>
                  Quem apresenta e com qual voz? ({avatares.length} avatares)
                </PerguntaEtapa>
                {avatares.length === 0 ? (
                  <p className="dark:text-dark-300 text-xs text-gray-400">
                    Nenhum avatar disponível na conta.
                  </p>
                ) : (
                  <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                    {avatares.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAvatarId(a.id)}
                        className={clsx(
                          "relative overflow-hidden rounded-lg border-2 transition-colors",
                          avatarId === a.id
                            ? "border-primary-500"
                            : "dark:border-dark-600 border-transparent hover:border-gray-300",
                        )}
                        title={a.nome}
                      >
                        {a.preview ? (
                          <img
                            src={a.preview}
                            alt={a.nome}
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="dark:bg-dark-600 text-tiny grid aspect-square w-full place-items-center bg-gray-100 text-gray-400">
                            {a.nome.slice(0, 12)}
                          </div>
                        )}
                        {avatarId === a.id && (
                          <span className="text-primary-500 absolute top-1 right-1">
                            <CheckCircleIcon className="size-5" />
                          </span>
                        )}
                        <span className="dark:bg-dark-800/80 dark:text-dark-100 text-tiny absolute inset-x-0 bottom-0 truncate bg-white/80 px-1 py-0.5 text-gray-700">
                          {a.nome}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 max-w-sm">
                  <label className={ROTULO_CAMPO}>Voz</label>
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    {vozes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome} {v.idioma ? `· ${v.idioma}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <AcoesEtapa
                  onContinuar={() => etapas.concluirEtapa("avatar")}
                  desabilitado={!avatarId || !voiceId}
                />
              </LabEtapa>

              <LabEtapa {...etapas.etapa("formato")}>
                <PerguntaEtapa>Formato e acabamento</PerguntaEtapa>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={ROTULO_CAMPO}>Formato</label>
                    <select
                      value={formato}
                      onChange={(e) => setFormato(e.target.value)}
                      className={`${CAMPO_SELECT} rounded-lg`}
                    >
                      {FORMATOS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={ROTULO_CAMPO}>
                      Velocidade: {speed}×
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                      className="accent-primary-600 mt-3 w-full"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <label className="dark:text-dark-100 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <Checkbox
                      checked={usarFundo}
                      onChange={(e) => setUsarFundo(e.target.checked)}
                      className="size-4"
                    />
                    Cor de fundo
                  </label>
                  {usarFundo && (
                    <input
                      type="color"
                      value={fundo}
                      onChange={(e) => setFundo(e.target.value)}
                      className="dark:border-dark-500 h-8 w-12 cursor-pointer rounded border border-gray-300"
                    />
                  )}
                  <label className="dark:text-dark-100 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <Checkbox
                      checked={teste}
                      onChange={(e) => setTeste(e.target.checked)}
                      className="size-4"
                    />
                    Modo teste
                    <span className="dark:text-dark-300 text-gray-400">
                      (marca d’água, sem gastar créditos)
                    </span>
                  </label>
                </div>
                <AcoesEtapa onContinuar={() => etapas.concluirEtapa("formato")} />
              </LabEtapa>
            </Accordion>

            {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

            <div className="mt-5 flex justify-end">
              <Button
                type="submit"
                color="primary"
                disabled={!script.trim() || !avatarId || !voiceId}
                className="h-10 gap-2 px-5"
              >
                <FilmIcon className="size-5" /> Gerar vídeo
              </Button>
            </div>
          </form>
        )}
      </div>
    </IaModalShell>
  );
}
