// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { ChartBarIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  getEscutaAtiva,
  getMotorVoz,
  getTtsAtivo,
  getVozNeural,
  getVozNome,
  setEscutaAtiva,
  setMotorVoz,
  setTtsAtivo,
  setVozNeural,
  setVozNome,
  type MotorVoz,
} from "@/utils/oraclePrefs";
import {
  VOZES_NEURAIS,
  VOZ_NEURAL_PADRAO,
  baixarVoz,
  removerVoz,
  vozNeuralSuportada,
  vozesBaixadas,
} from "@/utils/vozNeural";
import {
  falaSuportada,
  falar,
  pararFala,
  vozesDisponiveis,
  vozesDoIdioma,
} from "@/utils/falar";
import { Select } from "@/components/ui/Form";
import { WAKE_WORD } from "@/configs/wakeWord";
import { fetchUsoTokensApi, type UsoTokens } from "@/services/api/uso";
import { AiConnectionCard } from "./AiConnectionCard";
import { AparenciaSection } from "./AparenciaSection";
import { AmbienteLocalSection } from "./AmbienteLocalSection";
import { SectionCard, ToggleRow } from "./configuracoes-ui";
import { RegrasSection } from "./Memoria";
import { PainelAdministracao } from "./Administracao";
import { NavegacaoSecoes } from "./NavegacaoSecoes";
import {
  ehSecaoAdministracao,
  resolverSecao,
  type SecaoId,
} from "./configuracoes-secoes";
import { RepositorioSection } from "./repositorio-org/RepositorioSection";
import { AgentesOrganizacaoSection } from "./AgentesUsuarioSection";
import { RepositorioArquivos } from "./repositorio-org/RepositorioArquivos";
import { useDonoRepositorio } from "./repositorio-org/useDocumentosOrg";
import {
  ROTULO_ESCOPO_PESSOAL,
  useRotuloOrganizacaoAtiva,
} from "@/app/pages/prototypes/contas/model/context";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { isOracleModuleVisible } from "@/configs/oracleModules";

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
//   • Aparência — em arquivo próprio (AparenciaSection.tsx), com duas abas:
//     animação de fundo e vinheta (preferências locais) e os guias de marca da
//     organização, que decidem a cara do que o AI Studio gera.
//   • Voz — resposta falada (TTS) após comandos de voz (preferência local).
//   • IA & API — conexões BYOK (Texto/Imagem/Vídeo) via AiConnectionCard +
//     consumo de tokens do usuário (GET /uso/tokens), este último oculto
//     enquanto `settingsTokenUsage` estiver ligada.
//   • Regras — orientações persistidas que a IA segue em suas respostas.
//   • Repositório — a base de conhecimento compartilhada da organização
//     (repositorio-org/): card + listagem própria (`?vista=arquivos`) com
//     upload. Os documentos vivem no servidor, escopados pela organização, e
//     entram no contexto da IA; não aparecem na lista pessoal nem no grafo.
//     A antiga seleção de pasta local do protótipo saiu daqui e virou a
//     "Pasta local" do rodapé da sidebar (PastaLocalPanel.tsx).
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
  // Oracle pessoal (módulo `organizations` oculto): não há organização a
  // nomear — a tela é simplesmente "Configurações".
  const comOrganizacoes = isOracleModuleVisible("organizations");
  const titulo = !comOrganizacoes
    ? "Configurações"
    : organizacao == null
      ? // Nenhum repositório aberto: não há organização a nomear, e inventar um
        // nome ou deixar um ":" pendurado seria pior que o título curto.
        "Configurações da organização"
      : organizacao === ROTULO_ESCOPO_PESSOAL
        ? // "Configurações da organização: Organização pessoal" repetiria a
          // palavra duas vezes. Aqui o rótulo entra na própria frase.
          "Configurações da organização pessoal"
        : `Configurações da organização: ${organizacao}`;

  const vista = searchParams.get("vista");
  const donoRepositorio = useDonoRepositorio();

  const abrirVista = (proxima: string | null) => {
    const proximosParametros = new URLSearchParams(searchParams);
    if (proxima) proximosParametros.set("vista", proxima);
    else proximosParametros.delete("vista");
    setSearchParams(proximosParametros);
  };

  const selecionarSecao = (secao: SecaoId) => {
    const proximosParametros = new URLSearchParams(searchParams);
    proximosParametros.set("secao", secao);
    // `aba` era a sub-aba de Estrutura na antiga tela de Administração. Sem
    // este delete, um `?aba=cargos` vindo de um link antigo grudaria na URL em
    // todas as trocas seguintes.
    proximosParametros.delete("aba");
    // `vista` é a sub-tela da seção (hoje só a listagem do Repositório).
    proximosParametros.delete("vista");
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
                  {!comOrganizacoes ? (
                    <>
                      <p>
                        <strong>Configurações</strong> é onde você ajusta o
                        Oracle:{" "}
                        <strong>Geral</strong> (aparência, as identidades
                        visuais e os templates de apresentação, voz e o
                        Repositório, a sua base de conhecimento) e{" "}
                        <strong>IA</strong> (as orientações que a IA segue nas
                        respostas, os agentes chamados por @menção no
                        Assistente e a conexão dos provedores de IA).
                      </p>
                      <p>
                        As preferências de aparência e voz ficam salvas só
                        neste navegador. Identidades visuais, templates e
                        documentos do Repositório ficam na sua conta.
                      </p>
                    </>
                  ) : (
                  <>
                  <p>
                    <strong>Configurações</strong> é onde a plataforma e a
                    organização se configuram, em quatro grupos:{" "}
                    <strong>Geral</strong> (aparência, as identidades visuais e
                    os templates de apresentação da organização, voz e o
                    Repositório, a base de conhecimento
                    compartilhada da organização),{" "}
                    <strong>IA</strong> (as orientações que a IA segue nas
                    respostas, os agentes da organização chamados por
                    @menção no Assistente e a conexão dos provedores de IA da
                    empresa),{" "}
                    <strong>Estrutura</strong> (as pessoas da organização, as
                    áreas e cargos que ocupam e a hierarquia entre elas) e{" "}
                    <strong>Acesso</strong> (as roles, que dizem o que cada
                    pessoa pode fazer).
                  </p>
                  <p>
                    As preferências de aparência e voz ficam salvas só neste
                    navegador. As identidades visuais, os templates e os
                    documentos do Repositório são a exceção: pertencem à organização e valem
                    para todo mundo nela.
                  </p>
                  </>
                  )}
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
            {comOrganizacoes
              ? "Preferências do painel e da organização"
              : "Preferências do Oracle"}
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
            {active === "ambiente-local" && <AmbienteLocalSection />}
            {active === "agentes" && (
              // `key` pelo dono: trocar de organização recarrega a lista.
              <AgentesOrganizacaoSection key={donoRepositorio ?? ""} />
            )}
            {active === "memoria" &&
              (vista === "arquivos" ? (
                // `key` pelo dono: trocar de organização remonta a listagem,
                // com o carregamento do zero, em vez de mostrar a lista velha.
                <RepositorioArquivos
                  key={donoRepositorio ?? ""}
                  onVoltar={() => abrirVista(null)}
                />
              ) : (
                <RepositorioSection
                  onVisualizarArquivos={() => abrirVista("arquivos")}
                />
              ))}

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
// Voz

// "Resposta falada" (TTS): a barra de pesquisa lê a resposta em voz alta
// quando a pergunta foi feita por voz (voz do navegador, utils/falar.ts).
const MOSTRAR_RESPOSTA_FALADA = true;

const FRASE_TESTE = "Olá! Eu sou o Oracle. É assim que vou ler as respostas das suas perguntas por voz.";

/**
 * Escolha do motor de fala (voz do navegador ou voz neural local Piper) e da
 * voz, com teste. Vale para a resposta falada e para o Resumo Matinal.
 */
function EscolhaDeVoz() {
  const [motor, setMotor] = useState<MotorVoz>(getMotorVoz);
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([]);
  const [nome, setNome] = useState(getVozNome);
  const [neural, setNeural] = useState(() => getVozNeural() || VOZ_NEURAL_PADRAO);
  const [baixadas, setBaixadas] = useState<string[]>([]);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    void vozesDisponiveis().then((v) => vivo && setVozes(vozesDoIdioma(v, "pt-BR")));
    void vozesBaixadas().then((b) => vivo && setBaixadas(b));
    return () => {
      vivo = false;
      pararFala();
    };
  }, []);

  const neuralOk = vozNeuralSuportada();
  const baixada = baixadas.includes(neural);
  const info = VOZES_NEURAIS.find((v) => v.id === neural);

  const baixar = async () => {
    setErro("");
    setProgresso(0);
    try {
      await baixarVoz(neural, setProgresso);
      setBaixadas(await vozesBaixadas());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível baixar a voz.");
    } finally {
      setProgresso(null);
    }
  };

  const remover = async () => {
    pararFala();
    await removerVoz(neural);
    setBaixadas(await vozesBaixadas());
  };

  const testar = () => {
    setErro("");
    setTestando(true);
    const idioma = info?.idioma ?? "pt-BR";
    const frase = idioma === "en-US" ? "Hi! I am Oracle. This is how I will read your answers aloud." : FRASE_TESTE;
    void falar(frase, {
      idioma,
      ...(motor === "navegador" ? { vozNome: nome } : {}),
      onFim: () => setTestando(false),
    }).finally(() => setTimeout(() => setTestando(false), 15000));
  };

  if (!falaSuportada() && !neuralOk) {
    return (
      <p className="dark:text-dark-300 text-xs-plus py-3 text-gray-500">
        Este navegador não tem voz sintetizada. Use Chrome ou Edge.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <Select
        label="Motor de voz"
        value={motor}
        onChange={(e) => {
          const m = e.target.value as MotorVoz;
          pararFala();
          setMotor(m);
          setMotorVoz(m);
          if (m === "neural" && !getVozNeural()) setVozNeural(neural);
        }}
        data={[
          { label: "Voz do navegador", value: "navegador" },
          ...(neuralOk
            ? [{ label: "Voz neural local (Piper) — mais natural, grátis", value: "neural" }]
            : []),
        ]}
        description={
          motor === "neural"
            ? "Open source, roda no seu computador: não gasta tokens nem envia o texto para fora. O modelo é baixado uma vez e fica guardado neste navegador."
            : undefined
        }
      />

      {motor === "navegador" ? (
        <Select
          label="Voz"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setVozNome(e.target.value);
          }}
          data={[
            { label: "Automática (a mais natural disponível)", value: "" },
            ...vozes.map((v) => ({ label: `${v.name} · ${v.lang}`, value: v.name })),
          ]}
          description={
            vozes.some((v) => /natural|neural/i.test(v.name))
              ? undefined
              : "Para vozes mais naturais, use a voz neural local ou o Microsoft Edge."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Select
            label="Voz neural"
            value={neural}
            onChange={(e) => {
              pararFala();
              setNeural(e.target.value);
              setVozNeural(e.target.value);
            }}
            data={VOZES_NEURAIS.map((v) => ({
              label: `${v.idioma === "pt-BR" ? "Português" : "Inglês"} · ${v.rotulo}${baixadas.includes(v.id) ? " ✓" : ""}`,
              value: v.id,
            }))}
            description={
              info?.idioma === "en-US"
                ? `Voz em inglês: só é usada quando o Oracle fala em inglês. As respostas em português usam ${
                    VOZES_NEURAIS.some((v) => v.idioma === "pt-BR" && baixadas.includes(v.id))
                      ? "a voz em português já baixada"
                      : "a voz do navegador até você baixar uma voz em português (Faber ou Edresson)"
                  }.`
                : baixada
                  ? "Baixada neste navegador."
                  : "Ainda não baixada — enquanto isso, o Oracle usa a voz do navegador."
            }
          />
          {progresso !== null ? (
            <div className="flex items-center gap-3">
              <div className="dark:bg-dark-500 h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="bg-primary-500 h-full transition-all"
                  style={{ width: `${Math.round(progresso * 100)}%` }}
                />
              </div>
              <span className="dark:text-dark-300 w-10 text-right text-xs text-gray-500">
                {Math.round(progresso * 100)}%
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!baixada && (
                <Button color="primary" className="h-9 rounded-lg" onClick={() => void baixar()}>
                  Baixar voz (~{info?.mb ?? 60} MB)
                </Button>
              )}
              {baixada && (
                <Button variant="flat" className="h-9 rounded-lg" onClick={() => void remover()}>
                  Remover do navegador
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-error text-xs">{erro}</p>}

      <div>
        <Button variant="outlined" className="h-9 rounded-lg" disabled={progresso !== null} onClick={testar}>
          {testando ? "Falando…" : "Testar voz"}
        </Button>
        {motor === "neural" && baixada && (
          <span className="dark:text-dark-300 ml-3 text-xs text-gray-500">
            A primeira fala carrega o modelo e leva alguns segundos.
          </span>
        )}
      </div>
    </div>
  );
}

function VozSection() {
  const [tts, setTts] = useState(getTtsAtivo);
  const [escuta, setEscuta] = useState(getEscutaAtiva);

  return (
    <SectionCard
      titulo="Voz"
      descricao="Como o Oracle ouve e responde a comandos de voz."
    >
      <div className="dark:divide-dark-500 divide-y divide-gray-100">
        <ToggleRow
          nome={`Ativação por voz (“${WAKE_WORD.rotulo}”)`}
          descricao={`Diga só “${WAKE_WORD.rotulo}”, espere o bipe e faça a pergunta: o Oracle envia sozinho quando você parar de falar e fecha o microfone do ditado até ouvir a palavra de novo. A palavra é detectada no seu computador — o áudio só vai para o reconhecimento de fala do navegador depois dela.`}
          checked={escuta}
          onChange={(v) => {
            setEscuta(v);
            setEscutaAtiva(v);
          }}
        />
        {MOSTRAR_RESPOSTA_FALADA && (
          <ToggleRow
            nome="Resposta falada"
            descricao="Quando a pergunta é feita por voz, o Oracle lê a resposta em voz alta (um resumo das respostas longas). Para interromper, diga a palavra de ativação, clique no microfone ou feche a resposta."
            checked={tts}
            onChange={(v) => {
              setTts(v);
              setTtsAtivo(v);
              if (!v) pararFala();
            }}
          />
        )}
        {/* A voz vale também para o Resumo Matinal, com ou sem resposta falada. */}
        <EscolhaDeVoz />
      </div>
      {escuta && (
        <p className="dark:text-dark-300 mt-4 text-xs text-gray-500">
          Funciona com o Oracle aberto no navegador. O ponto verde no
          microfone da barra de pesquisa indica que ele está esperando a
          palavra; se ficar vermelho, passe o mouse nele para ver o motivo. O
          modelo de voz fica em ts/demo/public/wake/ (passo a passo em
          docs/ativacao-por-voz.md).
        </p>
      )}
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
        descricao="Conecte os seus provedores de IA e defina a prioridade dos modelos por modalidade."
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
