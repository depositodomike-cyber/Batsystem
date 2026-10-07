// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { ChartBarIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { getTtsAtivo, setTtsAtivo } from "@/utils/beculturePrefs";
import { fetchUsoTokensApi, type UsoTokens } from "@/services/api/uso";
import { AiConnectionCard } from "./AiConnectionCard";
import { AparenciaSection } from "./AparenciaSection";
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
import { RepositorioArquivos } from "./repositorio-org/RepositorioArquivos";
import { useDonoRepositorio } from "./repositorio-org/useDocumentosOrg";
import {
  ROTULO_ESCOPO_PESSOAL,
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
                  <p>
                    <strong>Configurações</strong> é onde a plataforma e a
                    organização se configuram, em quatro grupos:{" "}
                    <strong>Geral</strong> (aparência, as identidades visuais da
                    organização, voz e o Repositório, a base de conhecimento
                    compartilhada da organização),{" "}
                    <strong>IA</strong> (as orientações que a IA segue nas
                    respostas e a conexão dos provedores de IA da empresa),{" "}
                    <strong>Estrutura</strong> (as pessoas da organização, as
                    áreas e cargos que ocupam e a hierarquia entre elas) e{" "}
                    <strong>Acesso</strong> (as roles, que dizem o que cada
                    pessoa pode fazer).
                  </p>
                  <p>
                    As preferências de aparência e voz ficam salvas só neste
                    navegador. As identidades visuais e os documentos do
                    Repositório são a exceção: pertencem à organização e valem
                    para todo mundo nela.
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
