// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  SwatchIcon,
  SpeakerWaveIcon,
  CpuChipIcon,
  BookOpenIcon,
  CircleStackIcon,
  FolderIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Switch, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  getGrafoAtivo,
  getVinhetaAtiva,
  getTtsAtivo,
  setGrafoAtivo,
  setVinhetaAtiva,
  setTtsAtivo,
} from "@/utils/beculturePrefs";
import { fetchUsoTokensApi, type UsoTokens } from "@/services/api/uso";
import { AiConnectionCard } from "./AiConnectionCard";
import { RegrasSection } from "./Memoria";
import {
  escolherPastaContexto,
  pastaContextoNativa,
  pastaContextoSuportada,
  pastaContextoSalva,
  pastaEhCopia,
} from "./memoria-inventario";
import {
  DISABLED_MENU_CLASS,
  isFeatureTemporarilyDisabled,
  type TemporarilyDisabledFeature,
} from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Configurações — porta o painel ⚙ do beculture/Confi (app antigo) para o SaaS.
// Reúne cinco grupos:
//   • Aparência — animação de fundo e vinheta (preferências locais).
//   • Voz — resposta falada (TTS) após comandos de voz (preferência local).
//   • IA & API — conexões BYOK (Texto/Imagem/Vídeo) via AiConnectionCard +
//     consumo de tokens do usuário (GET /uso/tokens).
//   • Regras — orientações persistidas que a IA segue em suas respostas.
//   • Repositório — pasta de dados que alimenta o grafo. No SaaS web isso é
//     um diretório escolhido pelo navegador (File System Access API), persistido
//     no MESMO IndexedDB usado pela tela Repositório, então a escolha vale nas duas.
// ----------------------------------------------------------------------

const SECOES = [
  {
    id: "aparencia",
    titulo: "Aparência",
    icon: SwatchIcon,
    feature: "settingsAppearance" as TemporarilyDisabledFeature,
  },
  {
    id: "voz",
    titulo: "Voz",
    icon: SpeakerWaveIcon,
    feature: "settingsVoice" as TemporarilyDisabledFeature,
  },
  {
    id: "ia",
    titulo: "IA & API",
    icon: CpuChipIcon,
    feature: null,
  },
  {
    id: "regras",
    titulo: "Regras",
    icon: BookOpenIcon,
    feature: null,
  },
  {
    id: "memoria",
    titulo: "Repositório",
    icon: CircleStackIcon,
    feature: "settingsMemory" as TemporarilyDisabledFeature,
  },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

function secaoEstaDesabilitada(secao: (typeof SECOES)[number]): boolean {
  return (
    secao.feature != null && isFeatureTemporarilyDisabled(secao.feature)
  );
}

function primeiraSecaoAtiva(): SecaoId {
  return SECOES.find((s) => !secaoEstaDesabilitada(s))?.id ?? "ia";
}

export default function Configuracoes() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const secaoSolicitada = searchParams.get("secao");
  const active =
    SECOES.find(
      (secao) =>
        secao.id === secaoSolicitada && !secaoEstaDesabilitada(secao),
    )?.id ?? primeiraSecaoAtiva();

  const selecionarSecao = (secao: SecaoId) => {
    const proximosParametros = new URLSearchParams(searchParams);
    proximosParametros.set("secao", secao);
    setSearchParams(proximosParametros);
  };

  return (
    <Page title={`Configurações · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              description: (
                <>
                  <p><strong>Configurações</strong> reúne as preferências do painel: <strong>Aparência</strong> (animação de fundo e vinheta), <strong>Voz</strong> (resposta falada após comandos de voz), <strong>IA &amp; API</strong> (conexão dos provedores de IA da empresa e consumo de tokens), <strong>Regras</strong> (orientações que a IA segue nas respostas) e <strong>Repositório</strong> (a pasta de dados que alimenta o grafo).</p>
                  <p>As preferências de aparência e voz ficam salvas só neste navegador, e a pasta do Repositório é lida localmente — nenhum arquivo é enviado a servidores.</p>
                </>
              ),
            }}
          >
            Configurações
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Preferências de aparência, voz, inteligência artificial, regras e
            a pasta de dados que alimenta o Repositório.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* Navegação lateral */}
          <nav className="lg:w-56 lg:shrink-0">
            <ul className="dark:border-dark-600 dark:bg-dark-700 flex gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 lg:flex-col lg:gap-1">
              {SECOES.map((s) => {
                const disabled = secaoEstaDesabilitada(s);
                const isActive = !disabled && active === s.id;
                return (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    {disabled ? (
                      <div
                        aria-disabled="true"
                        className={clsx(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-dark-200",
                          DISABLED_MENU_CLASS,
                        )}
                      >
                        <s.icon className="size-4.5 shrink-0" />
                        {s.titulo}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selecionarSecao(s.id)}
                        className={clsx(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary-600 text-white dark:bg-primary-500"
                            : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-600 hover:bg-gray-100",
                        )}
                      >
                        <s.icon className="size-4.5 shrink-0" />
                        {s.titulo}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Painel da seção ativa */}
          <div className="min-w-0 flex-1">
            {active === "aparencia" && <AparenciaSection />}
            {active === "voz" && <VozSection />}
            {active === "ia" && <IaSection />}
            {active === "regras" && <RegrasSection />}
            {active === "memoria" && <MemoriaSection />}
          </div>
        </div>
      </div>
    </Page>
  );
}

// ----------------------------------------------------------------------
// Bloco base de uma seção (cartão + título + descrição).

function SectionCard({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
        {titulo}
      </h3>
      <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
        {descricao}
      </p>
      <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />
      {children}
    </div>
  );
}

/** Linha com título/descrição à esquerda e um interruptor à direita. */
function ToggleRow({
  nome,
  descricao,
  checked,
  onChange,
}: {
  nome: string;
  descricao: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          {nome}
        </p>
        <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-500">
          {descricao}
        </p>
      </div>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="shrink-0"
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Aparência

function AparenciaSection() {
  const [grafo, setGrafo] = useState(getGrafoAtivo);
  const [vinheta, setVinheta] = useState(getVinhetaAtiva);

  return (
    <SectionCard
      titulo="Aparência"
      descricao="Ajustes visuais do painel. As escolhas ficam salvas só neste navegador."
    >
      <div className="divide-y divide-gray-100 dark:divide-dark-500">
        <ToggleRow
          nome="Animação de fundo"
          descricao="A rede de nós animada por trás do painel."
          checked={grafo}
          onChange={(v) => {
            setGrafo(v);
            setGrafoAtivo(v);
          }}
        />
        <ToggleRow
          nome="Vinheta"
          descricao="Escurecimento suave nas bordas da tela."
          checked={vinheta}
          onChange={(v) => {
            setVinheta(v);
            setVinhetaAtiva(v);
          }}
        />
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------
// Voz

function VozSection() {
  const [tts, setTts] = useState(getTtsAtivo);

  return (
    <SectionCard
      titulo="Voz"
      descricao="Como o assistente responde a comandos de voz."
    >
      <div className="divide-y divide-gray-100 dark:divide-dark-500">
        <ToggleRow
          nome="Resposta falada"
          descricao="Lê as respostas em voz alta após um comando de voz."
          checked={tts}
          onChange={(v) => {
            setTts(v);
            setTtsAtivo(v);
          }}
        />
      </div>
    </SectionCard>
  );
}

// ----------------------------------------------------------------------
// IA & API

/** Formata número grande de forma compacta em pt-BR: 950 · 1,2 mil · 3,4 mi. */
function fmtTokens(n: number): string {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6)
    return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(".", ",") + " mil";
  return (n / 1e6).toFixed(1).replace(".", ",") + " mi";
}

const JANELAS: { chave: keyof UsoTokens; label: string }[] = [
  { chave: "hora", label: "Última hora" },
  { chave: "dia", label: "Últimas 24h" },
  { chave: "semana", label: "7 dias" },
  { chave: "mes", label: "30 dias" },
];

function IaSection() {
  return (
    <div className="space-y-6">
      <SectionCard
        titulo="IA & Modelos"
        descricao="Conecte os provedores de IA da sua empresa (BYOK). A chave é criptografada no servidor e nunca é exibida."
      >
        <AiConnectionCard />
      </SectionCard>

      <SectionCard
        titulo="Consumo de tokens"
        descricao="Tokens processados pela sua conta nas janelas recentes. Atualiza automaticamente."
      >
        <TokenUsagePanel />
      </SectionCard>
    </div>
  );
}

function TokenUsagePanel() {
  const [uso, setUso] = useState<UsoTokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ultimoRef = useRef<UsoTokens | null>(null);

  // `load` não muda estado de forma síncrona (só dentro dos callbacks da
  // promise), então pode ser chamado direto no efeito sem cascata de renders.
  const load = useCallback(async () => {
    try {
      const d = await fetchUsoTokensApi();
      ultimoRef.current = d;
      setUso(d);
      setErro(null);
    } catch {
      // Mantém o último valor bom; só mostra erro se nunca carregou.
      if (!ultimoRef.current) setErro("Não foi possível carregar o consumo.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Botão "Atualizar": mostra o spinner (síncrono, fora de efeito) e recarrega.
  const carregar = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    // IIFE assíncrona: o setState só ocorre depois do await (dentro de `load`),
    // então não há cascata de renders síncrona no corpo do efeito.
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {JANELAS.map((j) => (
          <div
            key={j.chave}
            className="dark:border-dark-500 dark:bg-dark-600 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <p className="dark:text-dark-300 text-tiny-plus text-gray-400">
              {j.label}
            </p>
            <p className="dark:text-dark-50 mt-1 text-xl font-semibold text-gray-800 tabular-nums">
              {uso ? fmtTokens(uso[j.chave].total) : "—"}
            </p>
            {uso && (
              <p className="dark:text-dark-300 mt-0.5 text-tiny text-gray-400 tabular-nums">
                ↑ {fmtTokens(uso[j.chave].entrada)} · ↓{" "}
                {fmtTokens(uso[j.chave].saida)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={carregar}
          disabled={loading}
          className="dark:border-dark-450 h-9 gap-1.5 border border-gray-300 text-xs"
        >
          {loading ? (
            <Spinner className="size-3.5 border-2" />
          ) : (
            <ArrowPathIcon className="size-4" />
          )}
          Atualizar
        </Button>
        <span className="dark:text-dark-300 inline-flex items-center gap-1 text-xs text-gray-400">
          <ChartBarIcon className="size-4" />
          {erro ?? "Entrada (↑) e saída (↓) somadas no período."}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Memória — pasta de dados (File System Access API + IndexedDB)
//
// Usa o MESMO banco/chave da tela Repositório (ceo-memoria/kv/dir-handle:<conta>),
// de modo que selecionar a pasta aqui reflete lá e vice-versa. Roda 100% no navegador.

function MemoriaSection() {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [copia, setCopia] = useState(false);
  // Suporte é fixo no mount; init lazy evita setState dentro de efeito.
  const [supported] = useState(() => pastaContextoSuportada());
  const [nativa] = useState(() => pastaContextoNativa());

  useEffect(() => {
    // setFolderName só ocorre após o await (assíncrono): sem cascata de renders.
    (async () => {
      const handle = await pastaContextoSalva();
      if (!handle) return;
      setFolderName(handle.name);
      setCopia(pastaEhCopia(handle));
    })();
  }, []);

  const pickFolder = useCallback(async () => {
    const escolha = await escolherPastaContexto();
    if (!escolha.ok) {
      if (escolha.reason === "unsupported") {
        toast("Navegador sem suporte", {
          description: "Este navegador não permite selecionar pastas.",
        });
      }
      return;
    }
    setFolderName(escolha.dir.name);
    setCopia(pastaEhCopia(escolha.dir));
    toast.success(`Pasta do Repositório definida: “${escolha.dir.name}”.`, {
      description: "Abra a tela Repositório para carregar o grafo desta pasta.",
    });
  }, []);

  return (
    <SectionCard
      titulo="Pasta do Repositório"
      descricao="Onde ficam os arquivos que o Repositório conecta — reuniões, insights, notas e documentos. O grafo lê os arquivos .md desta pasta."
    >
      <div className="dark:border-dark-500 dark:bg-dark-600 flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-10 shrink-0 place-items-center rounded-lg">
            <FolderIcon className="size-5.5" />
          </span>
          <div className="min-w-0">
            <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
              {folderName ?? "Nenhuma pasta selecionada"}
            </p>
            <p className="dark:text-dark-300 text-xs-plus text-gray-500">
              {folderName
                ? copia
                  ? "Cópia somente leitura — reselecione a pasta para ver alterações."
                  : "Pasta atual do Repositório neste navegador."
                : "Selecione a pasta que o Repositório deve usar como fonte."}
            </p>
          </div>
        </div>
        <Button
          color="primary"
          onClick={pickFolder}
          disabled={!supported}
          className="h-10 shrink-0 gap-1.5 rounded-lg"
        >
          <FolderIcon className="size-4.5" />
          {folderName ? "Trocar pasta" : "Selecionar pasta"}
        </Button>
      </div>

      {!supported ? (
        <p className="mt-3 text-xs-plus text-warning">
          Seleção de pasta indisponível neste navegador. Use o Chrome ou o Edge.
        </p>
      ) : (
        !nativa && (
          <p className="mt-3 text-xs-plus text-warning">
            Este navegador lê a pasta como cópia: o Repositório abre normalmente, mas
            a IA não grava notas de volta nos arquivos e mudanças feitas fora do
            navegador só aparecem quando você reselecionar a pasta. No Brave, o
            acesso completo liga em{" "}
            <span className="font-mono">brave://flags/#file-system-access-api</span>.
          </p>
        )
      )}

      <p className="dark:text-dark-300 mt-4 text-xs-plus text-gray-400">
        A pasta é lida localmente pelo navegador — nenhum arquivo é enviado a
        servidores. A escolha é compartilhada com a tela Repositório.
      </p>
    </SectionCard>
  );
}
