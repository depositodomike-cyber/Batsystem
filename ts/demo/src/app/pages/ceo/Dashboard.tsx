// Import Dependencies
import { useState } from "react";
import {
  ChartBarSquareIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Accordion, Button, Checkbox } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { gerarDashboardApi, type Dashboard } from "@/services/api/dashboard";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  AcoesEtapa,
  AJUDA_CAMPO,
  CAIXA_ERRO,
  CAMPO_TEXTAREA,
  errMessage,
  LabAjuste,
  LabCarregando,
  LabEtapa,
  LabPagina,
  LabResultado,
  PerguntaEtapa,
  ROTULO_CAMPO,
  useCriacaoLab,
  useEtapasLab,
  type PassoLab,
} from "./lab";
import { toast } from "sonner";
import { abrirEmJanelaPropria, usePreviaIsolada } from "@/utils/abrirPrevia";
import { ehDesktop } from "@/utils/desktop";

// ----------------------------------------------------------------------
// Criar Dashboard — página do Lab (era janela). Gera uma página HTML autônoma
// (KPIs, gráficos, tabelas) a partir de um objetivo + dados colados. Geração
// direta e refino iterativo. Salva em Minhas criações.
// ----------------------------------------------------------------------

const FALHA = "Falha ao gerar o dashboard. Tente novamente.";

function nomeArquivo(titulo: string): string {
  return `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "dashboard"}.html`;
}

type EtapaId = "objetivo" | "dados";
const ETAPAS = [
  { id: "objetivo" as const, numero: "01", titulo: "Objetivo" },
  { id: "dados" as const, numero: "02", titulo: "Dados e contexto" },
];

export default function DashboardPagina() {
  const [tema, setTema] = useState("");
  const [dados, setDados] = useState("");
  const [contexto, setContexto] = useState("");
  const [usarMemoria, setUsarMemoria] = useState(false);

  const [passo, setPasso] = useState<PassoLab>("form");
  const [refinando, setRefinando] = useState(false);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  // Desktop: prévia por URL isolada (oracle-previa:); web: srcDoc, como antes.
  const urlPrevia = usePreviaIsolada(dashboard?.html ?? null);
  const [ajuste, setAjuste] = useState("");

  const design = useActiveDesignSystem();

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    objetivo: tema.trim().slice(0, 80) || undefined,
    dados: [
      dados.trim() ? "Dados colados" : "Sem dados — exemplos plausíveis",
      usarMemoria ? "Repositório como referência" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  const criacao = useCriacaoLab({
    tipo: "dashboard",
    passo,
    erro: Boolean(erro) && !dashboard,
    relevante: tema.trim().length >= 20 || dashboard != null,
    titulo: dashboard?.titulo || tema.trim().slice(0, 80),
    dados: { tema, dados, contexto, usarMemoria, dashboard },
    restaurar: (d) => {
      setTema(d.tema ?? "");
      setDados(d.dados ?? "");
      setContexto(d.contexto ?? "");
      setUsarMemoria(Boolean(d.usarMemoria));
      if (d.dashboard) {
        setDashboard(d.dashboard);
        setPasso("pronta");
      }
    },
  });

  const pedido = () => ({
    tema: tema.trim(),
    dados: dados.trim() || undefined,
    contexto: contexto.trim() || undefined,
    fontes: usarMemoria ? (["memoria"] as ["memoria"]) : undefined,
    design,
  });

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o objetivo do dashboard.");
    setPasso("gerando");
    try {
      setDashboard(await gerarDashboardApi(pedido()));
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err, FALHA));
      setPasso("form");
    }
  };

  const refazer = async () => {
    if (!dashboard || !ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const data = await gerarDashboardApi({
        ...pedido(),
        ajuste: ajuste.trim(),
        anterior: dashboard,
      });
      setDashboard(data);
      setAjuste("");
    } catch (err) {
      setErro(errMessage(err, FALHA));
    } finally {
      setRefinando(false);
    }
  };

  const novo = () => {
    criacao.reiniciar();
    setDashboard(null);
    setAjuste("");
    setErro("");
    setTema("");
    setDados("");
    setContexto("");
    setPasso("form");
    etapas.reiniciar();
  };

  const abrirEmNovaAba = () => {
    if (!dashboard) return;
    const blob = new Blob([dashboard.html], { type: "text/html" });
    // Web: nova aba (blob). Desktop: janela de prévia isolada (HTML gerado por IA).
    void abrirEmJanelaPropria(blob, { titulo: "Dashboard — Oracle" }).catch((e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir."),
    );
  };

  const baixar = () => {
    if (!dashboard) return;
    const blob = new Blob([dashboard.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo(dashboard.titulo);
    a.click();
    URL.revokeObjectURL(url);
  };

  // O painel é um HTML autônomo: vai como anexo (Repositório e grupo), com a
  // descrição da IA como corpo do texto.
  const prepararConteudo = async () => ({
    conteudo: [
      dashboard?.descricao || "Painel gerado pela IA.",
      dashboard?.conexoes?.trim(),
    ]
      .filter(Boolean)
      .join("\n\n"),
    anexos: [
      {
        nome: "painel.html",
        dados: new Blob([dashboard?.html ?? ""], { type: "text/html" }),
      },
    ],
  });

  return (
    <LabPagina
      titulo="Criar dashboard"
      subtitulo="Você diz o que quer acompanhar, a IA monta o painel e você refina."
      Icone={ChartBarSquareIcon}
      tint="bg-cyan-500/10 text-cyan-500"
      ajuda={
        <>
          <p>
            Descreva o <strong>objetivo</strong> do painel e, se tiver, cole os
            dados (números, tabelas ou CSV). A IA gera uma página HTML com KPIs,
            gráficos e tabelas.
          </p>
          <p>
            Sem dados, a IA usa exemplos plausíveis marcados como tal. Com o
            painel pronto, use <strong>Peça um ajuste</strong> para mudar
            gráficos, destaques ou o visual.
          </p>
        </>
      }
    >
      {criacao.erroAoCarregar && (
        <div className={`${CAIXA_ERRO} mb-4`}>{criacao.erroAoCarregar}</div>
      )}

      {passo === "form" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void gerar();
          }}
        >
          <Accordion {...etapas.accordion} className="flex flex-col gap-3">
            <LabEtapa {...etapas.etapa("objetivo")}>
              <PerguntaEtapa>O que o dashboard precisa mostrar?</PerguntaEtapa>
              <MemoriaTextarea
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                rows={3}
                placeholder="Ex.: Meu orçamento do trimestre — gastos por categoria, evolução mensal e maiores despesas"
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />
              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("objetivo")}
                desabilitado={!tema.trim()}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("dados")} pendenteLabel="Opcional">
              <PerguntaEtapa>Quais dados o painel deve usar?</PerguntaEtapa>
              <MemoriaTextarea
                value={dados}
                onChange={(e) => setDados(e.target.value)}
                rows={5}
                placeholder="Cole números, tabelas ou CSV."
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />
              <p className={AJUDA_CAMPO}>
                Sem dados, a IA usa exemplos plausíveis marcados como tal.
              </p>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Contexto e instruções{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (opcional)
                  </span>
                </label>
                <MemoriaTextarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  rows={2}
                  placeholder="Período, o que destacar, tipos de gráfico preferidos…"
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
              </div>

              <label className="dark:text-dark-100 mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={usarMemoria}
                  onChange={(e) => setUsarMemoria(e.target.checked)}
                  className="size-4"
                />
                Usar o Repositório como referência
              </label>
              <AcoesEtapa onContinuar={() => etapas.concluirEtapa("dados")} />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!tema.trim()}
              className="h-10 gap-2 px-5"
            >
              <ChartBarSquareIcon className="size-5" />
              Gerar dashboard
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Montando o dashboard…"
          descricao="A IA está escolhendo os indicadores e os gráficos."
        />
      )}

      {passo === "pronta" && dashboard && (
        <LabResultado
          titulo={dashboard.titulo || "Dashboard pronto"}
          descricao={dashboard.descricao || undefined}
          erro={erro}
          acoesSecundarias={
            <Button variant="flat" onClick={novo} className="gap-1.5">
              <ArrowPathIcon className="size-4" /> Novo dashboard
            </Button>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.dashboard}
                titulo={dashboard.titulo}
                tags={["dashboard"]}
                versao={dashboard.html.length}
                preparar={prepararConteudo}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="dashboard"
                titulo={dashboard.titulo}
                versao={dashboard.html.length}
                preparar={prepararConteudo}
                className="h-10 px-5"
              />
              <Button
                variant="outlined"
                onClick={abrirEmNovaAba}
                className="h-10 gap-2 px-5"
              >
                <ArrowTopRightOnSquareIcon className="size-5" /> Abrir
              </Button>
              <Button
                color="primary"
                onClick={baixar}
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" /> Baixar .html
              </Button>
            </>
          }
        >
          {/* Prévia — HTML gerado num iframe isolado (sandbox). */}
          <div className="dark:border-dark-600 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <iframe
              title={dashboard.titulo}
              {...(ehDesktop()
                ? { src: urlPrevia ?? "about:blank" }
                : { srcDoc: dashboard.html })}
              sandbox="allow-scripts"
              className="h-[60vh] w-full border-0 bg-white"
            />
          </div>

          <div className="mt-4">
            <LabAjuste
              valor={ajuste}
              onChange={setAjuste}
              onRefazer={() => void refazer()}
              refinando={refinando}
              placeholder="Ex.: troque a barra por um gráfico de linha, destaque os maiores gastos…"
            />
          </div>
        </LabResultado>
      )}
    </LabPagina>
  );
}
