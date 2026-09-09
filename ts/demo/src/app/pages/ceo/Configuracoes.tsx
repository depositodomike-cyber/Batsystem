// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  CircleStackIcon,
  FolderIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

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
import { PainelAdministracao } from "./Administracao";
import { NavegacaoSecoes } from "./NavegacaoSecoes";
import {
  ehSecaoAdministracao,
  resolverSecao,
  type SecaoId,
} from "./configuracoes-secoes";
import {
  escolherPastaContexto,
  pastaContextoNativa,
  pastaContextoSuportada,
  pastaContextoSalva,
  pastaEhCopia,
} from "./memoria-inventario";
import {
  ROTULO_ESCOPO_PESSOAL,
  useRepositorioAtivo,
  useRepositoriosDoEscopoAtivo,
  useRotuloOrganizacaoAtiva,
} from "@/app/pages/prototypes/contas/model/context";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Configurações — o contexto ÚNICO de configuração da plataforma.
//
// Até esta versão havia duas telas: esta e "Administração", com a navegação
// lateral copiada literalmente entre as duas. Do ponto de vista de quem
// administra, as duas respondiam a mesma pergunta — como a plataforma e a
// organização se configuram —, então Administração deixou de ser uma área e os
// itens dela passaram a viver aqui, sob rótulos de grupo.
//
// A lista de seções e os grupos moram em `configuracoes-secoes.ts`, porque a
// MESMA lista alimenta o menu (`NavegacaoSecoes`) e o despacho do corpo.
//
// As seções renderizadas por ESTE arquivo:
//   • Aparência — animação de fundo e vinheta (preferências locais).
//   • Voz — resposta falada (TTS) após comandos de voz (preferência local).
//   • IA & API — conexões BYOK (Texto/Imagem/Vídeo) via AiConnectionCard +
//     consumo de tokens do usuário (GET /uso/tokens), este último oculto
//     enquanto `settingsTokenUsage` estiver ligada.
//   • Regras — orientações persistidas que a IA segue em suas respostas.
//   • Repositório — pasta de dados que alimenta o grafo. No SaaS web isso é
//     um diretório escolhido pelo navegador (File System Access API), persistido
//     no MESMO IndexedDB usado pela tela Repositório, então a escolha vale nas duas.
//
// As outras cinco (Membros, Áreas, Cargos, Hierarquia, Roles) vêm de um painel
// só, `PainelAdministracao`: elas compartilham dados e modais. Ver ali por que
// ele é despachado numa expressão JSX única, e não num branch por seção.
// ----------------------------------------------------------------------

export default function Configuracoes() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  // Seção desconhecida cai no padrão em silêncio, sem reescrever a URL — é o
  // comportamento de sempre, e corrigir a URL de um link velho tiraria de quem
  // compartilhou a chance de ver o que tinha mandado.
  const active: SecaoId = resolverSecao(searchParams.get("secao"));

  /**
   * O título nomeia a organização selecionada no menu de perfil, e troca junto
   * com ela — é estado de contexto React, então não há efeito nem requisição
   * aqui: a re-renderização é a própria atualização.
   *
   * O nome sai do MESMO selector que monta a lista do menu, de propósito: é o
   * nome que a pessoa acabou de clicar que tem de aparecer aqui.
   */
  const organizacao = useRotuloOrganizacaoAtiva();
  const titulo =
    organizacao == null
      ? // Nenhum repositório aberto: não há organização a nomear, e inventar um
        // nome ou deixar um ":" pendurado seria pior que o título curto.
        "Configurações da organização"
      : organizacao === ROTULO_ESCOPO_PESSOAL
        ? // "Configurações da organização: Organização pessoal" repetiria a
          // palavra duas vezes. Aqui o rótulo entra na própria frase.
          "Configurações da organização pessoal"
        : `Configurações da organização: ${organizacao}`;

  const selecionarSecao = (secao: SecaoId) => {
    const proximosParametros = new URLSearchParams(searchParams);
    proximosParametros.set("secao", secao);
    // `aba` era a sub-aba de Estrutura na antiga tela de Administração. Sem
    // este delete, um `?aba=cargos` vindo de um link antigo grudaria na URL em
    // todas as trocas seguintes.
    proximosParametros.delete("aba");
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
                  {/*
                    A menção a "consumo de tokens" saiu daqui junto com o bloco
                    ocultado por `settingsTokenUsage`. Ao desligar a flag,
                    voltar o trecho: "(conexão dos provedores de IA da empresa
                    e consumo de tokens)".
                  */}
                  <p>
                    <strong>Configurações</strong> é onde a plataforma e a
                    organização se configuram, em quatro grupos:{" "}
                    <strong>Geral</strong> (aparência, voz e a pasta de dados
                    que alimenta o grafo), <strong>IA</strong> (as orientações
                    que a IA segue nas respostas e a conexão dos provedores de
                    IA da empresa), <strong>Estrutura</strong> (as pessoas da
                    organização, as áreas e cargos que ocupam e a hierarquia
                    entre elas) e <strong>Acesso</strong> (as roles, que dizem o
                    que cada pessoa pode fazer).
                  </p>
                  <p>
                    As preferências de aparência e voz ficam salvas só neste
                    navegador, e a pasta do Repositório é lida localmente —
                    nenhum arquivo é enviado a servidores.
                  </p>
                </>
              ),
              // O cabeçalho do modal de ajuda, explícito porque `PageHelp`
              // cai no título da página quando omitido — e ali o nome da
              // organização não tem função: o texto explica a TELA.
              title: "Configurações",
            }}
          >
            {titulo}
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Preferências do painel e da organização
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* Navegação lateral, agrupada por rótulos de seção. */}
          <NavegacaoSecoes ativo={active} onSelecionar={selecionarSecao} />

          {/* Painel da seção ativa */}
          <div className="min-w-0 flex-1">
            {active === "aparencia" && <AparenciaSection />}
            {active === "voz" && <VozSection />}
            {active === "ia" && <IaSection />}
            {active === "regras" && <RegrasSection />}
            {active === "memoria" && <MemoriaSection />}

            {/*
              UMA expressão para as cinco seções de organização, e não um
              branch por seção. O painel é dono da lista de membros, do drawer
              e de dez modais; com um branch por seção, o mesmo componente
              apareceria em posições diferentes da árvore a cada clique e o
              React desmontaria e remontaria tudo — quatro chamadas de API,
              drawer fechado, filtros e busca zerados. Não aparece em code
              review, só na aba Network.
            */}
            {ehSecaoAdministracao(active) && (
              <PainelAdministracao secao={active} onIrPara={selecionarSecao} />
            )}
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
        <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
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
      <div className="dark:divide-dark-500 divide-y divide-gray-100">
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
      <div className="dark:divide-dark-500 divide-y divide-gray-100">
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
  const consumoOculto = isFeatureTemporarilyDisabled("settingsTokenUsage");

  return (
    <div className="space-y-6">
      <SectionCard
        titulo="IA & API"
        descricao="Conecte os provedores de IA da sua empresa e defina a prioridade dos modelos por modalidade."
      >
        <AiConnectionCard />
      </SectionCard>

      {!consumoOculto && (
        <SectionCard
          titulo="Consumo de tokens"
          descricao="Tokens processados pela sua conta nas janelas recentes. Atualiza automaticamente."
        >
          <TokenUsagePanel />
        </SectionCard>
      )}
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
              <p className="dark:text-dark-300 text-tiny mt-0.5 text-gray-400 tabular-nums">
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
// Lista os repositórios do escopo ativo e a pasta vinculada a cada um
// (ceo-memoria/kv/dir-handle:<repoId>). Roda 100% no navegador.

type PastaPorRepo = {
  nome: string | null;
  copia: boolean;
};

function MemoriaSection() {
  const repositorios = useRepositoriosDoEscopoAtivo();
  const ativo = useRepositorioAtivo();
  const [pastas, setPastas] = useState<Record<string, PastaPorRepo>>({});
  // Suporte é fixo no mount; init lazy evita setState dentro de efeito.
  const [supported] = useState(() => pastaContextoSuportada());
  const [nativa] = useState(() => pastaContextoNativa());

  const ids = repositorios.map((r) => r.id).join(",");

  useEffect(() => {
    let cancelado = false;
    const lista = ids ? ids.split(",") : [];

    (async () => {
      const proximo: Record<string, PastaPorRepo> = {};
      for (const id of lista) {
        const handle = await pastaContextoSalva(id);
        proximo[id] = handle
          ? { nome: handle.name, copia: pastaEhCopia(handle) }
          : { nome: null, copia: false };
      }
      if (!cancelado) setPastas(proximo);
    })();

    return () => {
      cancelado = true;
    };
  }, [ids]);

  const pickFolder = useCallback(
    async (repositorioId: string, nomeRepo: string) => {
      const escolha = await escolherPastaContexto(repositorioId);
      if (!escolha.ok) {
        if (escolha.reason === "unsupported") {
          toast("Navegador sem suporte", {
            description: "Este navegador não permite selecionar pastas.",
          });
        }
        return;
      }
      setPastas((prev) => ({
        ...prev,
        [repositorioId]: {
          nome: escolha.dir.name,
          copia: pastaEhCopia(escolha.dir),
        },
      }));
      toast.success(`Pasta vinculada a “${nomeRepo}”: “${escolha.dir.name}”.`, {
        description:
          "Abra a tela Repositório com este contexto ativo para carregar as notas.",
      });
    },
    [],
  );

  return (
    <SectionCard
      titulo="Repositórios"
      descricao="Cada repositório tem nome próprio e pode ter uma pasta local vinculada. O conteúdo não é compartilhado entre eles."
    >
      {repositorios.length === 0 ? (
        <p className="dark:text-dark-300 text-sm text-gray-500">
          Nenhum repositório neste escopo. Crie um pelo seletor da sidebar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {repositorios.map((repo) => {
            const pasta = pastas[repo.id];
            const folderName = pasta?.nome ?? null;
            const copia = pasta?.copia ?? false;
            const ehAtivo = ativo?.id === repo.id;

            return (
              <li
                key={repo.id}
                className="dark:border-dark-500 dark:bg-dark-600 flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-10 shrink-0 place-items-center rounded-lg">
                    <CircleStackIcon className="size-5.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="dark:text-dark-100 flex flex-wrap items-center gap-2 truncate text-sm font-medium text-gray-800">
                      <span className="truncate">{repo.nome}</span>
                      {ehAtivo ? (
                        <span className="bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                          Ativo
                        </span>
                      ) : null}
                    </p>
                    <p className="dark:text-dark-300 text-xs-plus mt-0.5 flex items-center gap-1.5 truncate text-gray-500">
                      <FolderIcon className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {folderName
                          ? copia
                            ? `${folderName} (cópia somente leitura)`
                            : folderName
                          : "Nenhuma pasta selecionada"}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  color="primary"
                  onClick={() => void pickFolder(repo.id, repo.nome)}
                  disabled={!supported}
                  className="h-10 shrink-0 gap-1.5 rounded-lg"
                >
                  <FolderIcon className="size-4.5" />
                  {folderName ? "Trocar pasta" : "Selecionar pasta"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!supported ? (
        <p className="text-xs-plus text-warning mt-3">
          Seleção de pasta indisponível neste navegador. Use o Chrome ou o Edge.
        </p>
      ) : (
        !nativa && (
          <p className="text-xs-plus text-warning mt-3">
            Este navegador lê a pasta como cópia: o Repositório abre
            normalmente, mas a IA não grava notas de volta nos arquivos e
            mudanças feitas fora do navegador só aparecem quando você
            reselecionar a pasta. No Brave, o acesso completo liga em{" "}
            <span className="font-mono">
              brave://flags/#file-system-access-api
            </span>
            .
          </p>
        )
      )}

      <p className="dark:text-dark-300 text-xs-plus mt-4 text-gray-400">
        A pasta é lida localmente pelo navegador — nenhum arquivo é enviado a
        servidores. A escolha é compartilhada com a tela Repositório do mesmo
        contexto.
      </p>
    </SectionCard>
  );
}
