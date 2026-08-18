// Import Dependencies
import { useState } from "react";
import {
  ChartBarSquareIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import {
  MemoriaTextarea,
  MemoriaInput,
} from "@/components/shared/MemoriaMentions";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { gerarDashboardApi, type Dashboard } from "@/services/api/dashboard";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar Dashboard — gera uma página HTML autônoma (KPIs, gráficos, tabelas) a
// partir de um objetivo + dados colados. Geração direta e refino iterativo
// (peça um ajuste; a IA refaz preservando o bom). Mesma linha do "Criar artigo".
// ----------------------------------------------------------------------

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar o dashboard. Tente novamente.";
}

function nomeArquivo(titulo: string): string {
  return `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "dashboard"}.html`;
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function DashboardModal({ isOpen, close, onMinimize }: Props) {
  const [tema, setTema] = useState("");
  const [dados, setDados] = useState("");
  const [contexto, setContexto] = useState("");
  const [usarMemoria, setUsarMemoria] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refinando, setRefinando] = useState(false);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [ajuste, setAjuste] = useState("");

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  const fechar = () => {
    if (loading || refinando) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o objetivo do dashboard.");
    setLoading(true);
    try {
      const data = await gerarDashboardApi({
        tema: tema.trim(),
        dados: dados.trim() || undefined,
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
      });
      setDashboard(data);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const refazer = async () => {
    if (!dashboard || !ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const data = await gerarDashboardApi({
        tema: tema.trim(),
        dados: dados.trim() || undefined,
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
        ajuste: ajuste.trim(),
        anterior: dashboard,
      });
      setDashboard(data);
      setAjuste("");
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setRefinando(false);
    }
  };

  const novo = () => {
    setDashboard(null);
    setAjuste("");
    setErro("");
  };

  const abrirEmNovaAba = () => {
    if (!dashboard) return;
    const blob = new Blob([dashboard.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoga depois de um tempo para dar tempo de a aba carregar.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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

  // O painel é um HTML autônomo: vai como anexo (Memória e grupo), com a
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
    <IaModalShell
      isOpen={isOpen}
      close={fechar}
      onMinimize={onMinimize}
      closeDisabled={loading || refinando}
      title="IA · Criar Dashboard"
      icon={ChartBarSquareIcon}
      size="4xl"
    >
      <div>
        {/* Resultado */}
        {dashboard ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="dark:text-dark-50 truncate text-lg font-bold text-gray-800">
                  {dashboard.titulo}
                </h2>
                {dashboard.descricao && (
                  <p className="dark:text-dark-300 text-xs-plus truncate text-gray-500">
                    {dashboard.descricao}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  onClick={novo}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ArrowPathIcon className="size-4" /> Novo
                </Button>
                <Button
                  onClick={abrirEmNovaAba}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ArrowTopRightOnSquareIcon className="size-4" /> Abrir
                </Button>
                <Button
                  onClick={baixar}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ArrowDownTrayIcon className="size-4" /> .html
                </Button>
                <SalvarNaMemoriaButton
                  pasta={PASTA_MEMORIA.dashboard}
                  titulo={dashboard.titulo}
                  tags={["dashboard"]}
                  versao={dashboard.html.length}
                  preparar={prepararConteudo}
                />
                <EnviarParaGrupoButton
                  funcao="dashboard"
                  titulo={dashboard.titulo}
                  versao={dashboard.html.length}
                  preparar={prepararConteudo}
                />
              </div>
            </div>

            {/* Prévia — HTML gerado num iframe isolado (sandbox). */}
            <div className="dark:border-dark-600 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <iframe
                title={dashboard.titulo}
                srcDoc={dashboard.html}
                sandbox="allow-scripts"
                className="h-[60vh] w-full border-0 bg-white"
              />
            </div>

            {/* Refino iterativo */}
            <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-5 rounded-xl border border-gray-200 p-3">
              <label className="dark:text-dark-200 text-xs-plus mb-1.5 flex items-center gap-1.5 font-medium text-gray-600">
                <SparklesIcon className="size-4" /> Peça um ajuste
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <MemoriaInput
                  value={ajuste}
                  onChange={(e) => setAjuste(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !refinando) refazer();
                  }}
                  disabled={refinando}
                  placeholder="Ex.: troque a barra por um gráfico de linha, destaque o churn, tema mais escuro…"
                  className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                />
                <Button
                  onClick={refazer}
                  color="primary"
                  disabled={!ajuste.trim() || refinando}
                  className="gap-2"
                >
                  {refinando ? (
                    <Spinner className="size-4" />
                  ) : (
                    <ArrowPathIcon className="size-4" />
                  )}
                  Refazer
                </Button>
              </div>
              {erro && (
                <p className="text-xs-plus mt-2 text-rose-500">{erro}</p>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <Spinner className="size-6" />
              <p className="dark:text-dark-200 text-sm text-gray-600">
                A IA está montando o dashboard…
              </p>
            </div>
          </div>
        ) : (
          /* Formulário */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              gerar();
            }}
            className="flex flex-col gap-3"
          >
            <DesignSystemBar />

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Objetivo do dashboard <span className="text-rose-500">*</span>
              </label>
              <MemoriaTextarea
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                rows={2}
                placeholder="Ex.: Painel de vendas do trimestre — receita, ticket médio, funil e top produtos"
                className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Dados <span className="text-gray-400">(opcional)</span>
              </label>
              <MemoriaTextarea
                value={dados}
                onChange={(e) => setDados(e.target.value)}
                rows={4}
                placeholder="Cole números, tabelas ou CSV. Sem dados, a IA usa exemplos plausíveis marcados como tal."
                className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Contexto / instruções{" "}
                <span className="text-gray-400">(opcional)</span>
              </label>
              <MemoriaTextarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                rows={2}
                placeholder="Público, período, o que destacar, tipos de gráfico preferidos…"
                className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <label className="dark:text-dark-200 text-xs-plus flex cursor-pointer items-center gap-2 text-gray-600">
              <Checkbox
                checked={usarMemoria}
                onChange={(e) => setUsarMemoria(e.target.checked)}
                className="size-4"
              />
              Usar o Repositório como referência
            </label>

            {erro && (
              <div className="text-xs-plus rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {erro}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                color="primary"
                disabled={!tema.trim()}
                className="gap-2"
              >
                <ChartBarSquareIcon className="size-5" />
                Gerar dashboard
              </Button>
            </div>
          </form>
        )}
      </div>
    </IaModalShell>
  );
}
