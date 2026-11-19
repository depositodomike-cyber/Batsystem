// ----------------------------------------------------------------------
// Resumo Matinal — o briefing pessoal do dia, para ler ou ouvir.
// "Oracle, bom dia" (ou o botão Ouvir) apresenta o resumo por voz; o usuário
// pode interromper, perguntar sobre qualquer item e continuar de onde parou.
//
// Camadas: dados e inteligência no ts/api (/briefing); aqui só a experiência
// (tela, voz, conversa) sobre a MESMA estrutura de conteúdo.
// ----------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";
import clsx from "clsx";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  LightBulbIcon,
  MicrophoneIcon,
  NewspaperIcon,
  PauseIcon,
  PaperAirplaneIcon,
  PlayIcon,
  SpeakerWaveIcon,
  StopIcon,
  SunIcon,
  MoonIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";

import { Page } from "@/components/shared/Page";
import { Button, Spinner } from "@/components/ui";
import { useAssistente } from "@/app/contexts/assistente/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  gerarBriefingApi,
  janelaDeHoje,
  obterBriefingApi,
  periodoPelaHora,
  verificarBriefingApi,
  type BriefingDados,
  type DocRef,
  type FonteId,
  type Periodo,
} from "@/services/api/briefing";
import { falar, pararFala } from "@/utils/falar";
import { getTtsAtivo } from "@/utils/oraclePrefs";
import { coletarOperacoes, criarTarefa } from "./operacoes";
import { detectarIntencao } from "./intencao";
import {
  EVENTO_BRIEFING,
  EVENTO_RESPOSTA_FALADA,
  contextoDoBriefing,
  encerrarSessao,
  iniciarSessao,
  type PedidoBriefing,
} from "./sessao";
import { useBriefingVoz } from "./useBriefingVoz";
import { Acao, Documentos, Item, LinkExterno, Meta, Secao, SeloNivel } from "./Secoes";

type Fase = "carregando" | "preparando" | "pronto" | "erro";

/** Uma geração por dia/período por vez (StrictMode e cliques repetidos). */
const geracoes = new Map<string, Promise<BriefingDados>>();

const ROTULO_FONTE: Record<FonteId, string> = {
  agenda: "Google Agenda",
  email: "Gmail",
  clima: "Clima",
  noticias: "Notícias",
  repositorio: "Repositório",
  operacoes: "Tarefas",
  perfil: "Perfil Pessoal",
  ia: "IA",
};

function saudacao(hora: number, idioma: "pt" | "en") {
  if (idioma === "en") return hora < 12 ? "Good morning" : hora < 18 ? "Good afternoon" : "Good evening";
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

function mensagemErro(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Não foi possível montar o briefing.";
}

// Reconhecimento de fala (mesma API do ditado do PromptBar).
import { ehDesktop } from "@/utils/desktop";
import { ReconhecimentoGravado } from "@/utils/ditadoGravado";

type Reconhecedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function ResumoMatinal() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const [params, setParams] = useSearchParams();
  const { perguntar, loading: assistenteCarregando } = useAssistente();
  const { projectsByProduct } = useProjectsContext();

  const periodoInicial = (params.get("periodo") as Periodo | null) ?? periodoPelaHora();
  const [periodo, setPeriodo] = useState<Periodo>(
    periodoInicial === "noite" || periodoInicial === "manha" ? periodoInicial : periodoPelaHora(),
  );
  const [briefing, setBriefing] = useState<BriefingDados | null>(null);
  const [fase, setFase] = useState<Fase>("carregando");
  const [erro, setErro] = useState("");
  const [novidades, setNovidades] = useState(false);
  const [respostaPronta, setRespostaPronta] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const [pergunta, setPergunta] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecedorRef = useRef<Reconhecedor | null>(null);

  const idioma = briefing?.idioma ?? "pt";
  const voz = useBriefingVoz(briefing?.roteiro ?? [], idioma);
  const vozRef = useRef(voz);
  useEffect(() => {
    vozRef.current = voz;
  });

  // Relógio.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------- carregar

  const abrir = useCallback(
    (p: Periodo, opts: { forcar?: boolean; ouvir?: boolean } = {}) => {
      const janela = janelaDeHoje(p);
      const chave = `${janela.data}|${p}`;
      const gerar = () => {
        setFase("preparando");
        let g = geracoes.get(chave);
        if (!g) {
          g = gerarBriefingApi(janela, coletarOperacoes(projectsByProduct(product.code))).finally(() =>
            geracoes.delete(chave),
          );
          geracoes.set(chave, g);
        }
        return g;
      };
      const pedido: Promise<{ b: BriefingDados; novo: boolean }> = opts.forcar
        ? gerar().then((b) => ({ b, novo: true }))
        : obterBriefingApi(janela.data, p).then((b) => (b ? { b, novo: false } : gerar().then((n) => ({ b: n, novo: true }))));
      return pedido
        .then(({ b, novo }) => {
          setBriefing(b);
          setPeriodo(p);
          setFase("pronto");
          setNovidades(false);
          iniciarSessao(b);
          if (opts.ouvir) vozRef.current.tocar(0, b.roteiro);
          if (!novo) {
            verificarBriefingApi(janela)
              .then((r) => setNovidades(r.novidades))
              .catch(() => undefined);
          }
        })
        .catch((err: unknown) => {
          setErro(mensagemErro(err));
          setFase("erro");
        });
    },
    [product.code, projectsByProduct],
  );

  // Primeira abertura (e "?ouvir=1" vindo do "Oracle, bom dia").
  const iniciouRef = useRef(false);
  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;
    const ouvir = params.get("ouvir") === "1";
    void abrir(periodo, { ouvir });
    if (params.has("ouvir") || params.has("periodo")) setParams({}, { replace: true });
  }, [abrir, params, periodo, setParams]);

  // Sessão: o PromptBar usa o briefing como contexto enquanto a página vive.
  useEffect(() => () => encerrarSessao(), []);

  // Pedidos vindos do PromptBar ("bom dia" já nesta página, "continue").
  useEffect(() => {
    const h = (e: Event) => {
      const pedido = (e as CustomEvent<PedidoBriefing>).detail;
      if (pedido.acao === "continuar") {
        setRespostaPronta(false);
        vozRef.current.retomar();
        return;
      }
      if (briefing && pedido.periodo === periodo) {
        if (pedido.ouvir) vozRef.current.tocar(0, briefing.roteiro);
      } else {
        vozRef.current.parar();
        void abrir(pedido.periodo, { ouvir: pedido.ouvir });
      }
    };
    window.addEventListener(EVENTO_BRIEFING, h);
    return () => window.removeEventListener(EVENTO_BRIEFING, h);
  }, [abrir, briefing, periodo]);

  // Resposta a uma pergunta terminou: oferece continuar o briefing.
  useEffect(() => {
    const h = () => setRespostaPronta(true);
    window.addEventListener(EVENTO_RESPOSTA_FALADA, h);
    return () => window.removeEventListener(EVENTO_RESPOSTA_FALADA, h);
  }, []);

  // O item de que o Oracle está falando entra na tela.
  const refsAtivos = useMemo(() => new Set(voz.segmentoAtual?.refs ?? []), [voz.segmentoAtual]);
  useEffect(() => {
    const primeiro = voz.segmentoAtual?.refs[0];
    if (!primeiro || voz.estado !== "falando") return;
    document.querySelector(`[data-ref="${primeiro}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [voz.segmentoAtual, voz.estado]);

  // ---------------------------------------------------------- conversa

  const perguntarAoOracle = useCallback(
    async (texto: string, porVoz = false) => {
      const t = texto.trim();
      if (!t) return;
      const intencao = detectarIntencao(t, { briefingAtivo: true });
      if (intencao?.tipo === "continuar") {
        setRespostaPronta(false);
        voz.retomar();
        return;
      }
      if (intencao?.tipo === "briefing") {
        if (intencao.periodo !== periodo) void abrir(intencao.periodo, { ouvir: porVoz });
        else if (briefing) voz.tocar(0, briefing.roteiro);
        return;
      }
      if (voz.estado === "falando") voz.pausar();
      setRespostaPronta(false);
      const r = await perguntar({ texto: t, modo: "vault", contexto: contextoDoBriefing() });
      if (!r.ok) {
        toast.error(r.erro || "Não consegui responder agora.");
        return;
      }
      if (porVoz && r.resposta && getTtsAtivo()) {
        void falar(r.resposta, {
          idioma: idioma === "en" ? "en-US" : "pt-BR",
          onFim: () => setRespostaPronta(true),
        });
      } else if (voz.estado === "pausado") {
        setRespostaPronta(true);
      }
    },
    [abrir, briefing, idioma, perguntar, periodo, voz],
  );

  const enviarPergunta = () => {
    const t = pergunta;
    setPergunta("");
    void perguntarAoOracle(t);
  };

  const ouvirPergunta = () => {
    if (ouvindo) {
      reconhecedorRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
    // Oracle Desktop: o Web Speech não funciona no Electron; grava e transcreve na API.
    const Ctor: (new () => Reconhecedor) | undefined = ehDesktop()
      ? (ReconhecimentoGravado as unknown as new () => Reconhecedor)
      : (w.SpeechRecognition ?? w.webkitSpeechRecognition);
    if (!Ctor) {
      toast.error("Este navegador não reconhece fala. Use o Chrome ou o Edge, ou digite a pergunta.");
      return;
    }
    if (voz.estado === "falando") voz.pausar();
    pararFala();
    const rec = new Ctor();
    rec.lang = idioma === "en" ? "en-US" : "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    let texto = "";
    rec.onresult = (e) => {
      texto = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ");
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("O microfone está bloqueado para este site. Libere a permissão no navegador.");
      } else if (e.error === "audio-capture") {
        toast.error("Nenhum microfone encontrado.");
      }
    };
    rec.onend = () => {
      setOuvindo(false);
      reconhecedorRef.current = null;
      if (texto.trim()) void perguntarAoOracle(texto, true);
    };
    reconhecedorRef.current = rec;
    setOuvindo(true);
    try {
      rec.start();
    } catch {
      setOuvindo(false);
    }
  };

  const sobreDocumento = (d: DocRef) =>
    void perguntarAoOracle(`O que o documento "${d.titulo}" do meu Repositório diz de relevante para hoje?`);

  const novaTarefa = (titulo: string) => {
    try {
      const r = criarTarefa(titulo);
      toast.success(`Tarefa criada em ${r.board} › ${r.column}.`);
    } catch (err) {
      toast.error(mensagemErro(err));
    }
  };

  // ---------------------------------------------------------- render

  const en = idioma === "en";
  const loc = en ? "en-US" : "pt-BR";
  const hora = (iso: string) => new Date(iso).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  const dataCurta = (iso: string) =>
    new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const fontesComProblema = briefing
    ? (Object.entries(briefing.fontes) as [FonteId, NonNullable<BriefingDados["fontes"][FonteId]>][]).filter(
        ([id, f]) => f.status !== "ok" && id !== "operacoes" && !(id === "clima" && f.status === "sem-config"),
      )
    : [];
  const hoje = briefing?.agenda.filter((a) => a.dia === "hoje") ?? [];
  const amanha = briefing?.agenda.filter((a) => a.dia === "amanha") ?? [];
  const vazio =
    briefing &&
    !briefing.agenda.length &&
    !briefing.comunicacoes.length &&
    !briefing.projetos.length &&
    !briefing.noticias.length &&
    !briefing.insights.length;
  const configUrl = (secao: string) => `/${product.code}/configuracoes-usuario?secao=${secao}`;

  const rotuloEstado = assistenteCarregando
    ? "Processando sua pergunta…"
    : fase === "preparando"
      ? "Preparando o briefing…"
      : ouvindo
        ? "Ouvindo sua pergunta…"
        : voz.estado === "falando"
          ? "Falando"
          : voz.estado === "pausado"
            ? "Pausado"
            : voz.estado === "concluido"
              ? "Aguardando sua pergunta"
              : "Pronto para apresentar";

  return (
    <Page title={`Resumo Matinal · ${product.name}`}>
      <div className="transition-content mx-auto w-full max-w-4xl px-(--margin-x) py-6">
        {/* ---------- Cabeçalho ---------- */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="dark:text-dark-300 flex items-center gap-1.5 text-xs font-medium tracking-wide text-gray-500 uppercase">
              {periodo === "noite" ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
              {periodo === "noite" ? (en ? "Evening summary" : "Resumo noturno") : en ? "Morning briefing" : "Resumo Matinal"}
            </p>
            <h1 className="dark:text-dark-50 mt-1 text-2xl font-semibold text-gray-800 sm:text-3xl">
              {saudacao(agora.getHours(), idioma)}
              {briefing?.nome ? `, ${briefing.nome}` : ""}.
            </h1>
            <p className="dark:text-dark-200 mt-1 text-gray-600">
              {periodo === "noite"
                ? en
                  ? "Here is how your day went."
                  : "Aqui está como foi o seu dia."
                : en
                  ? "Here is the summary of your life today."
                  : "Aqui está o resumo da sua vida hoje."}
            </p>
            <p className="dark:text-dark-300 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="capitalize">
                {agora.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}
              </span>
              <span>·</span>
              <span>{agora.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}</span>
              {briefing?.clima && (
                <>
                  <span>·</span>
                  <span title={`Previsão: ${briefing.clima.periodo}`}>
                    {briefing.clima.cidade}: {briefing.clima.temperatura}°C, {briefing.clima.condicao}
                    {briefing.clima.minima !== undefined && briefing.clima.maxima !== undefined
                      ? ` (${briefing.clima.minima}°–${briefing.clima.maxima}°`
                      : ""}
                    {briefing.clima.chanceChuva !== undefined && briefing.clima.minima !== undefined
                      ? `, ${en ? "rain" : "chuva"} ${briefing.clima.chanceChuva}%)`
                      : briefing.clima.minima !== undefined
                        ? ")"
                        : ""}
                  </span>
                </>
              )}
              {briefing?.fontes.clima?.status === "sem-config" && (
                <Link to={configUrl("perfil")} className="text-primary-600 dark:text-primary-400 hover:underline">
                  Defina sua cidade no Perfil Pessoal para ver o clima
                </Link>
              )}
            </p>
            {briefing?.sintese && (
              <p className="dark:text-dark-100 mt-4 border-l-2 border-primary-500 pl-3 text-gray-700 italic">
                {briefing.sintese}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outlined"
              className="gap-1.5"
              disabled={fase === "preparando" || fase === "carregando"}
              onClick={() => {
                voz.parar();
                void abrir(periodo === "noite" ? "manha" : "noite");
              }}
              title={periodo === "noite" ? "Ver o resumo matinal" : "Ver o resumo noturno"}
            >
              {periodo === "noite" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
              {periodo === "noite" ? (en ? "Morning" : "Matinal") : en ? "Evening" : "Noturno"}
            </Button>
            <Button
              variant="outlined"
              isIcon
              title="Atualizar o resumo"
              disabled={fase === "preparando" || fase === "carregando"}
              onClick={() => {
                voz.parar();
                void abrir(periodo, { forcar: true });
              }}
            >
              <ArrowPathIcon className={clsx("size-4", fase === "preparando" && "animate-spin")} />
            </Button>
          </div>
        </header>

        {/* ---------- Voz ---------- */}
        {briefing && fase === "pronto" && (
          <div className="dark:border-dark-600 dark:bg-dark-700 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 sm:px-4">
            {/* O briefing só começa a tocar pelo comando de voz ("Oracle, bom dia");
                aqui ficam apenas os controles de quem já está ouvindo. */}
            {voz.suportada && (voz.estado === "falando" || voz.estado === "pausado") ? (
              <>
                {voz.estado === "falando" ? (
                  <Button color="primary" className="gap-1.5" onClick={voz.pausar}>
                    <PauseIcon className="size-4" /> Pausar
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    className="gap-1.5"
                    onClick={() => {
                      setRespostaPronta(false);
                      voz.retomar();
                    }}
                  >
                    <PlayIcon className="size-4" /> Continuar
                  </Button>
                )}
                <Button variant="flat" isIcon title="Recomeçar" onClick={voz.repetir}>
                  <ArrowUturnLeftIcon className="size-4" />
                </Button>
                <Button variant="flat" isIcon title="Interromper" onClick={voz.parar}>
                  <StopIcon className="size-4" />
                </Button>
                <label className="dark:text-dark-300 flex items-center gap-1.5 text-gray-500" title="Volume">
                  <SpeakerWaveIcon className="size-4" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={voz.volume}
                    onChange={(e) => voz.setVolume(Number(e.target.value))}
                    className="accent-primary-500 w-20"
                    aria-label="Volume"
                  />
                </label>
              </>
            ) : (
              <span className="dark:text-dark-300 flex items-center gap-1.5 text-xs text-gray-500">
                <MicrophoneIcon className="size-4" />
                {voz.suportada
                  ? en
                    ? "Say “Oracle, good morning” to hear the briefing."
                    : "Diga “Oracle, bom dia” para ouvir o briefing."
                  : en
                    ? "This browser has no speech synthesis."
                    : "Este navegador não tem voz sintetizada."}
              </span>
            )}

            <span className="dark:text-dark-300 ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <span
                className={clsx(
                  "size-2 rounded-full",
                  voz.estado === "falando" || ouvindo
                    ? "bg-primary-500 animate-pulse"
                    : assistenteCarregando
                      ? "animate-pulse bg-amber-500"
                      : "dark:bg-dark-400 bg-gray-300",
                )}
              />
              {rotuloEstado}
            </span>
          </div>
        )}

        {voz.segmentoAtual && (
          <p className="dark:text-dark-200 mt-3 px-1 text-sm text-gray-600 italic">“{voz.segmentoAtual.texto}”</p>
        )}

        {respostaPronta && voz.estado === "pausado" && (
          <div className="border-primary-500/30 bg-primary-500/5 mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm">
            <span className="dark:text-dark-100 text-gray-700">Quer que eu continue o briefing de onde parei?</span>
            <Button
              className="h-8 px-3 text-xs"
              color="primary"
              onClick={() => {
                setRespostaPronta(false);
                voz.retomar();
              }}
            >
              Continuar
            </Button>
            <span className="dark:text-dark-300 text-xs text-gray-500">ou diga “Oracle, continue”</span>
          </div>
        )}

        {/* ---------- Avisos e estados ---------- */}
        {briefing && fase === "pronto" && (
          <div className="dark:text-dark-300 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-gray-500">
            <span>
              Atualizado às {new Date(briefing.geradoEm).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}
            </span>
            {novidades && (
              <button
                type="button"
                onClick={() => {
                  voz.parar();
                  void abrir(periodo, { forcar: true });
                }}
                className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
              >
                Há novidades na agenda ou no e-mail — atualizar
              </button>
            )}
          </div>
        )}
        {fontesComProblema.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {fontesComProblema.map(([id, f]) => (
              <div
                key={id}
                className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
              >
                <ExclamationTriangleIcon className="mt-px size-4 shrink-0" />
                <span>
                  <strong>{ROTULO_FONTE[id]}:</strong>{" "}
                  {f.status === "desconectado"
                    ? "não conectado — nada dessa fonte entrou no resumo. "
                    : f.mensagem || "indisponível no momento."}
                  {f.status === "desconectado" && (
                    <Link to={configUrl("conectores")} className="underline">
                      Conectar
                    </Link>
                  )}
                  {id === "perfil" && (
                    <Link to={configUrl("perfil")} className="ml-1 underline">
                      Preencher o Perfil
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {(fase === "carregando" || fase === "preparando") && (
          <div className="dark:text-dark-300 mt-16 flex flex-col items-center gap-3 text-center text-sm text-gray-500">
            <Spinner color="primary" className="size-7" />
            {fase === "preparando" ? (
              <>
                <p className="dark:text-dark-100 font-medium text-gray-700">Preparando o seu briefing…</p>
                <p>Lendo agenda, e-mails, tarefas, Perfil, Repositório, clima e notícias.</p>
              </>
            ) : (
              <p>Carregando…</p>
            )}
          </div>
        )}

        {fase === "erro" && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
            <Button variant="outlined" onClick={() => void abrir(periodo, { forcar: true })}>
              Tentar novamente
            </Button>
          </div>
        )}

        {fase === "pronto" && vazio && (
          <p className="dark:text-dark-300 mt-12 text-center text-sm text-gray-500">
            Nada pedindo sua atenção agora. Aproveite o dia.
          </p>
        )}

        {/* ---------- Seções ---------- */}
        {fase === "pronto" && briefing && (
          <>
            {briefing.agenda.length > 0 && (
              <Secao titulo={en ? "Your schedule" : "Sua agenda"} icone={<CalendarDaysIcon />}>
                {[...hoje, ...amanha].map((a, i) => (
                  <Item key={a.ref} refId={a.ref} ativo={refsAtivos.has(a.ref)}>
                    {(i === 0 || (a.dia === "amanha" && hoje.length === i)) && (
                      <p className="dark:text-dark-300 mb-2 text-tiny font-semibold tracking-wider text-gray-400 uppercase">
                        {a.dia === "hoje" ? (en ? "Today" : "Hoje") : en ? "Tomorrow" : "Amanhã"}
                      </p>
                    )}
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          "w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums",
                          a.passado ? "dark:text-dark-400 text-gray-400" : "text-primary-600 dark:text-primary-400",
                        )}
                      >
                        {a.evento.diaInteiro ? (en ? "All day" : "Dia todo") : hora(a.evento.inicio)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={clsx(
                              "font-medium",
                              a.passado ? "dark:text-dark-300 text-gray-500" : "dark:text-dark-50 text-gray-800",
                            )}
                          >
                            {a.evento.titulo}
                          </p>
                          {a.nivel !== "informativo" && <SeloNivel nivel={a.nivel} idioma={idioma} />}
                          {a.conflito && (
                            <span className="text-tiny font-medium text-red-600 dark:text-red-400">
                              {en ? "Time conflict" : "Conflito de horário"}
                            </span>
                          )}
                          {a.passado && periodo === "noite" && (
                            <span className="text-tiny text-gray-400">
                              {en ? "already happened (not confirmed)" : "já passou (sem confirmação)"}
                            </span>
                          )}
                        </div>
                        <Meta>
                          {!a.evento.diaInteiro && `${hora(a.evento.inicio)}–${hora(a.evento.fim)}`}
                          {a.evento.local ? ` · ${a.evento.local}` : ""}
                          {a.evento.participantes ? ` · ${a.evento.participantes} participantes` : ""}
                        </Meta>
                        {a.nota && <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">{a.nota}</p>}
                        {a.preparacao && (
                          <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">
                            <span className="font-medium">{en ? "Prepare: " : "Preparar: "}</span>
                            {a.preparacao}
                          </p>
                        )}
                        <Documentos docs={a.docs} onAbrir={sobreDocumento} />
                        <div className="mt-1.5 -ml-1.5 flex flex-wrap gap-1">
                          {a.evento.link && <LinkExterno href={a.evento.link}>Abrir no Google Agenda</LinkExterno>}
                          {a.evento.reuniaoUrl && <LinkExterno href={a.evento.reuniaoUrl}>Entrar na reunião</LinkExterno>}
                          <Acao
                            onClick={() =>
                              void perguntarAoOracle(`O que eu preciso preparar para "${a.evento.titulo}"?`)
                            }
                          >
                            Perguntar ao Oracle
                          </Acao>
                        </div>
                      </div>
                    </div>
                  </Item>
                ))}
              </Secao>
            )}

            {briefing.comunicacoes.length > 0 && (
              <Secao titulo={en ? "Communications" : "Comunicações e pendências"} icone={<EnvelopeIcon />}>
                {briefing.comunicacoes.map((c) => (
                  <Item key={c.ref} refId={c.ref} ativo={refsAtivos.has(c.ref)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="dark:text-dark-50 font-medium text-gray-800">{c.resumo}</p>
                      <span
                        className={clsx(
                          "rounded px-1.5 py-px text-tiny font-medium",
                          c.exigeAcao
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "dark:bg-dark-600 dark:text-dark-200 bg-gray-100 text-gray-500",
                        )}
                      >
                        {c.exigeAcao ? (en ? "Needs action" : "Exige ação") : en ? "Informative" : "Informativo"}
                      </span>
                      {c.nivel !== "informativo" && <SeloNivel nivel={c.nivel} idioma={idioma} />}
                    </div>
                    <Meta>
                      {c.email.remetenteNome || c.email.remetenteEmail} · {dataCurta(c.email.data)} · Gmail · “{c.email.assunto}”
                    </Meta>
                    {c.motivo && (
                      <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">
                        <span className="font-medium">{en ? "Why: " : "Por quê: "}</span>
                        {c.motivo}
                      </p>
                    )}
                    <div className="mt-1.5 -ml-1.5 flex flex-wrap gap-1">
                      <LinkExterno href={c.email.link}>Abrir no Gmail</LinkExterno>
                      <Acao
                        onClick={() =>
                          void perguntarAoOracle(`Leia e resuma o e-mail "${c.email.assunto}" e diga o que preciso fazer.`)
                        }
                      >
                        Perguntar ao Oracle
                      </Acao>
                      {c.exigeAcao && (
                        <Acao tipo="criar" onClick={() => novaTarefa(`Responder: ${c.email.assunto}`)}>
                          Criar tarefa
                        </Acao>
                      )}
                    </div>
                  </Item>
                ))}
              </Secao>
            )}

            {briefing.projetos.length > 0 && (
              <Secao titulo={en ? "Projects and goals" : "Projetos e objetivos"} icone={<FlagIcon />}>
                {briefing.projetos.map((p) => (
                  <Item key={p.ref} refId={p.ref} ativo={refsAtivos.has(p.ref)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="dark:text-dark-50 font-medium text-gray-800">{p.titulo}</p>
                      <span className="dark:text-dark-300 text-tiny text-gray-400 uppercase">
                        {p.tipo === "tarefa" ? "tarefa" : p.tipo === "projeto" ? "projeto" : "objetivo"}
                      </span>
                      <SeloNivel nivel={p.nivel} idioma={idioma} />
                    </div>
                    {p.prazo && <Meta>Prazo: {p.prazo}</Meta>}
                    {p.situacao && <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">{p.situacao}</p>}
                    {p.proximoPasso && (
                      <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">
                        <span className="font-medium">{en ? "Next step: " : "Próximo passo: "}</span>
                        {p.proximoPasso}
                      </p>
                    )}
                    <Documentos docs={p.docs} onAbrir={sobreDocumento} />
                    <div className="mt-1.5 -ml-1.5 flex flex-wrap gap-1">
                      <Acao onClick={() => void perguntarAoOracle(`Como está "${p.titulo}" e qual deve ser o próximo passo?`)}>
                        Perguntar ao Oracle
                      </Acao>
                      {p.proximoPasso && p.tipo !== "tarefa" && (
                        <Acao tipo="criar" onClick={() => novaTarefa(p.proximoPasso ?? p.titulo)}>
                          Criar tarefa
                        </Acao>
                      )}
                    </div>
                  </Item>
                ))}
              </Secao>
            )}

            {briefing.noticias.length > 0 && (
              <Secao titulo={en ? "News and the world" : "Notícias e mundo"} icone={<NewspaperIcon />}>
                {briefing.noticias.map((n) => (
                  <Item key={n.ref} refId={n.ref} ativo={refsAtivos.has(n.ref)}>
                    <p className="dark:text-dark-50 font-medium text-gray-800">{n.titulo}</p>
                    <Meta>
                      {n.fonte} · {dataCurta(n.publicadoEm)}
                    </Meta>
                    {n.resumo && <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">{n.resumo}</p>}
                    {n.porQue && (
                      <p className="dark:text-dark-300 mt-1 text-xs text-gray-500">
                        <span className="font-medium">{en ? "Why it matters: " : "Por que pode importar: "}</span>
                        {n.porQue}
                      </p>
                    )}
                    <div className="mt-1.5 -ml-1.5 flex flex-wrap gap-1">
                      <LinkExterno href={n.link}>Abrir publicação</LinkExterno>
                      <Acao
                        onClick={() =>
                          void perguntarAoOracle(
                            `Por que a notícia "${n.titulo}" é importante para mim e como ela se relaciona com meus interesses e projetos?`,
                          )
                        }
                      >
                        Por que é importante?
                      </Acao>
                    </div>
                  </Item>
                ))}
              </Secao>
            )}

            {briefing.insights.length > 0 && (
              <Secao titulo="Oracle Insights" icone={<LightBulbIcon />}>
                {briefing.insights.map((ins, i) => (
                  <Item key={i} refId={`in${i}`} ativo={false}>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeloNivel
                        nivel={ins.tipo === "atencao" ? "atencao" : ins.tipo === "oportunidade" ? "oportunidade" : "importante"}
                        idioma={idioma}
                      />
                      <p className="dark:text-dark-50 font-medium text-gray-800">{ins.titulo}</p>
                    </div>
                    <p className="dark:text-dark-200 mt-1 text-sm text-gray-600">{ins.texto}</p>
                    <Meta>
                      {en ? "Based on: " : "Com base em: "}
                      {ins.origens.map((o) => o.rotulo).join(" · ")}
                    </Meta>
                    <div className="mt-1.5 -ml-1.5">
                      <Acao onClick={() => void perguntarAoOracle(`Vamos aprofundar: ${ins.titulo}. ${ins.texto}`)}>
                        Conversar sobre isso
                      </Acao>
                    </div>
                  </Item>
                ))}
              </Secao>
            )}

            {/* ---------- Conversa ---------- */}
            <section className="mt-8 mb-4">
              <div className="mb-3 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="text-primary-600 dark:text-primary-400 size-5" />
                <h3 className="dark:text-dark-50 text-base font-semibold text-gray-800">
                  {en ? "Continue the conversation" : "Continuar a conversa"}
                </h3>
              </div>
              <div className="dark:border-dark-600 dark:bg-dark-700 focus-within:border-primary-500 flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2">
                <textarea
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarPergunta();
                    }
                  }}
                  rows={1}
                  placeholder={en ? "What would you like to do now?" : "O que você gostaria de fazer agora?"}
                  className="dark:text-dark-50 max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                />
                <Button
                  variant="flat"
                  isIcon
                  title={ouvindo ? "Parar de ouvir" : "Perguntar por voz"}
                  onClick={ouvirPergunta}
                  className={clsx(ouvindo && "text-primary-600 animate-pulse")}
                >
                  <MicrophoneIcon className="size-5" />
                </Button>
                <Button color="primary" isIcon title="Enviar" disabled={!pergunta.trim()} onClick={enviarPergunta}>
                  <PaperAirplaneIcon className="size-4" />
                </Button>
              </div>
              <p className="dark:text-dark-400 mt-2 px-1 text-xs text-gray-400">
                As perguntas usam este resumo como contexto. Com a ativação por voz ligada, diga “Oracle” e pergunte.
              </p>
            </section>
          </>
        )}
      </div>
    </Page>
  );
}
