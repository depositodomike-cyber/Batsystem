// Import Dependencies
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
import { MarkdownView } from "./MarkdownView";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import {
  analisarConteudoApi,
  type AnaliseResult,
} from "@/services/api/analise";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { lerComMigracao } from "@/utils/escopoConta";

// ----------------------------------------------------------------------
// Análise de conteúdo — UI portada do beculture/Confi (ia.js). Formulário com
// arquivo/link, objetivo, descrição, viés, fontes e as 17 seções; barra de
// progresso; resultado em Markdown; exportar (.md / imprimir / copiar).
// ----------------------------------------------------------------------

const FONTES: [string, string][] = [
  ["memoria", "Repositório"],
  ["notas", "Notas"],
  ["insights", "Insights"],
  ["todos", "To-do's"],
];

const SECOES: [string, string][] = [
  ["1", "Variáveis consideradas"],
  ["2", "Tipo de conteúdo e contexto"],
  ["3", "Resumo executivo"],
  ["4", "Principais temas"],
  ["5", "Pontos mais importantes"],
  ["6", "Dados, indicadores e evidências"],
  ["7", "Análise qualitativa"],
  ["8", "Análise crítica"],
  ["9", "Riscos e pontos de atenção"],
  ["10", "Oportunidades"],
  ["11", "Relação com memória/notas/insights/to-do's"],
  ["12", "Decisões e responsabilidades"],
  ["13", "Inconsistências e dúvidas em aberto"],
  ["14", "Recomendações práticas"],
  ["15", "Análise específica por tipo"],
  ["16", "Tabela de ações recomendadas"],
  ["17", "Síntese final executiva"],
];

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

// Coleta o texto das Notas locais (widget Notas) para cruzamento.
function coletarReferenciaCliente(fontes: Set<string>): string {
  const partes: string[] = [];
  if (fontes.has("notas")) {
    try {
      // Preferência: formato atual (ceo-notas-itens); fallback legado ceo-notas.
      const raw =
        lerComMigracao("ceo-notas-itens") ??
        window.localStorage.getItem("ceo-notas");
      const arr = raw ? JSON.parse(raw) : [];
      const txt = Array.isArray(arr)
        ? arr
            .map((n: { texto?: string; corpo?: string; titulo?: string }) => {
              const linha = n.corpo ?? n.texto ?? n.titulo ?? "";
              return linha ? `- ${linha}` : "";
            })
            .filter(Boolean)
            .join("\n")
        : "";
      if (txt.trim()) partes.push(`### Notas\n${txt}`);
    } catch {
      /* ignora */
    }
  }
  return partes.join("\n\n");
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao analisar o conteúdo.";
}

// ---- Progresso (barra assintótica + fase + tempo), portado de ia.js ----
function useProgresso(ativo: boolean, temRef: boolean, nSecoes: number) {
  const [pct, setPct] = useState(0);
  const [fase, setFase] = useState("Lendo o conteúdo…");
  const [tempo, setTempo] = useState("0:00");
  const inicioRef = useRef(0);

  useEffect(() => {
    if (!ativo) return;
    inicioRef.current = Date.now();
    const rotulo = `Redigindo o relatório (${nSecoes} ${nSecoes === 1 ? "seção" : "seções"})…`;
    const fases: [number, string][] = [
      [0, "Lendo o conteúdo…"],
      [4, "Interpretando contexto e temas…"],
      [12, "Levantando dados, riscos e oportunidades…"],
      ...(temRef
        ? ([[24, "Cruzando com memória, notas, insights e to-do's…"]] as [
            number,
            string,
          ][])
        : []),
      [temRef ? 34 : 24, rotulo],
      [75, "Finalizando a análise…"],
    ];
    const tau = 38;
    const id = window.setInterval(() => {
      const s = (Date.now() - inicioRef.current) / 1000;
      setPct(Math.min(96, (1 - Math.exp(-s / tau)) * 100));
      setFase(fases.reduce((acc, f) => (s >= f[0] ? f[1] : acc), fases[0][1]));
      const mm = Math.floor(s / 60);
      const ss = Math.floor(s % 60);
      setTempo(`${mm}:${ss.toString().padStart(2, "0")}`);
    }, 250);
    return () => window.clearInterval(id);
  }, [ativo, temRef, nSecoes]);

  const concluir = () => setPct(100);
  const resetar = () => {
    setPct(0);
    setFase("Lendo o conteúdo…");
    setTempo("0:00");
  };
  return { pct, fase, tempo, concluir, resetar };
}

// ----------------------------------------------------------------------

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function AnaliseModal({ isOpen, close, onMinimize }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vies, setVies] = useState("ambos");
  const [fontes, setFontes] = useState<Set<string>>(new Set());
  const [secoes, setSecoes] = useState<Set<string>>(
    new Set(SECOES.map(([n]) => n)),
  );

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [result, setResult] = useState<AnaliseResult | null>(null);

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  const prog = useProgresso(loading, fontes.size > 0, secoes.size);

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const podeEnviar = useMemo(
    () => (!!arquivo || !!link.trim()) && !!objetivo.trim() && secoes.size > 0,
    [arquivo, link, objetivo, secoes],
  );

  const submeter = async () => {
    setErro("");
    if (!arquivo && !link.trim())
      return setErro("Envie um arquivo ou informe um link.");
    if (!objetivo.trim()) return setErro("Descreva o objetivo da análise.");
    if (secoes.size === 0)
      return setErro("Selecione ao menos uma seção da análise.");
    setLoading(true);
    prog.resetar();
    try {
      const data = await analisarConteudoApi({
        arquivo,
        link: link.trim() || undefined,
        objetivo: objetivo.trim(),
        descricao: descricao.trim() || undefined,
        vies,
        fontes: [...fontes],
        secoes: [...secoes],
        referencia: coletarReferenciaCliente(fontes) || undefined,
        design,
      });
      prog.concluir();
      setResult(data);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const novaAnalise = () => {
    setResult(null);
    setErro("");
  };

  const baixarMd = () => {
    if (!result) return;
    const blob = new Blob([`# ${result.titulo}\n\n${result.analise}`], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "analise"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.analise);
      toast("Copiado", {
        description: "Análise copiada para a área de transferência.",
      });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const imprimir = () => {
    if (!result || !resultRef.current) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${result.titulo}</title>` +
        `<style>body{font-family:Inter,system-ui,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 24px;color:#1f2937;line-height:1.55}` +
        `h1{font-size:22px}h2{font-size:17px;border-top:1px solid #eee;padding-top:14px;margin-top:22px}h3{font-size:15px}` +
        `table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}` +
        `th{background:#f8fafc}code{background:#f1f5f9;padding:1px 4px;border-radius:4px}blockquote{border-left:3px solid #ddd;margin:0;padding-left:12px;color:#555}</style>` +
        `</head><body><h1>${result.titulo}</h1>${resultRef.current.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const resultRef = useRef<HTMLDivElement | null>(null);

  const marcarSecoes = (v: boolean) =>
    setSecoes(v ? new Set(SECOES.map(([n]) => n)) : new Set());

  return (
    <IaModalShell
      isOpen={isOpen}
      close={close}
      onMinimize={onMinimize}
      closeDisabled={loading}
      title="IA · Análise de conteúdo"
      icon={MagnifyingGlassIcon}
    >
      <div>
        {/* Resultado */}
        {result ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                  {result.titulo}
                </h3>
                {result.origem && (
                  <p className="dark:text-dark-300 truncate text-xs text-gray-400">
                    Origem: {result.origem}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={novaAnalise}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ArrowPathIcon className="size-4" /> Nova análise
                </Button>
                <Button
                  onClick={copiar}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ClipboardDocumentIcon className="size-4" /> Copiar
                </Button>
                <Button
                  onClick={baixarMd}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <ArrowDownTrayIcon className="size-4" /> .md
                </Button>
                <Button
                  onClick={imprimir}
                  variant="outlined"
                  className="text-xs-plus h-8 gap-1.5 px-2.5"
                >
                  <PrinterIcon className="size-4" /> Imprimir
                </Button>
                <SalvarNaMemoriaButton
                  pasta={PASTA_MEMORIA.analise}
                  titulo={result.titulo}
                  conteudo={`${result.origem ? `> Origem: ${result.origem}\n\n` : ""}${result.analise}`}
                  tags={["análise"]}
                />
                <EnviarParaGrupoButton
                  funcao="analise"
                  titulo={result.titulo}
                  conteudo={`${result.origem ? `> Origem: ${result.origem}\n\n` : ""}${result.analise}`}
                />
              </div>
            </div>
            <div ref={resultRef}>
              <MarkdownView>{result.analise}</MarkdownView>
            </div>
          </div>
        ) : loading ? (
          /* Progresso */
          <div className="py-6">
            <div className="dark:text-dark-200 mb-2 flex items-center gap-2 text-sm text-gray-600">
              <Spinner className="size-4" />
              <span className="flex-1">{prog.fase}</span>
              <span className="dark:text-dark-300 text-gray-400 tabular-nums">
                {prog.tempo}
              </span>
            </div>
            <div className="dark:bg-dark-500 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="bg-primary-600 dark:bg-primary-500 h-full rounded-lg transition-[width] duration-300 ease-out"
                style={{ width: `${prog.pct.toFixed(1)}%` }}
              />
            </div>
            <p className="dark:text-dark-300 mt-3 text-xs text-gray-400">
              A análise roda no Claude e pode levar de alguns segundos a ~1
              minuto.
            </p>
          </div>
        ) : (
          /* Formulário */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submeter();
            }}
            className="flex flex-col gap-3"
          >
            <DesignSystemBar />

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Arquivo{" "}
                <span className="text-gray-400">
                  (.txt, .md, .pdf, .docx, .csv…)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <label className="dark:border-dark-500 dark:hover:border-dark-400 text-xs-plus dark:text-dark-200 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-gray-600 hover:border-gray-400">
                  <ArrowUpTrayIcon className="size-4" />
                  Carregar arquivo
                  <input
                    type="file"
                    accept={ACCEPT}
                    hidden
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="dark:text-dark-300 min-w-0 truncate text-xs text-gray-500">
                  {arquivo?.name ?? ""}
                </span>
              </div>
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Ou um link{" "}
                <span className="text-gray-400">
                  (o arquivo tem prioridade)
                </span>
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Objetivo da análise <span className="text-rose-500">*</span>
              </label>
              <MemoriaTextarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={2}
                placeholder="O que você quer descobrir com esta análise?"
                className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Qual o conteúdo do arquivo ou link{" "}
                <span className="text-gray-400">(opcional)</span>
              </label>
              <MemoriaTextarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Ex.: relatório de vendas do 1º trimestre, artigo de opinião, transcrição…"
                className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Viés de análise
              </label>
              <select
                value={vies}
                onChange={(e) => setVies(e.target.value)}
                className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ambos">
                  Ambos (qualitativa + quantitativa)
                </option>
                <option value="qualitativa">Qualitativa</option>
                <option value="quantitativa">Quantitativa</option>
              </select>
            </div>

            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1.5 block font-medium text-gray-600">
                Relacionar com assuntos em{" "}
                <span className="text-gray-400">(opcional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {FONTES.map(([id, nome]) => {
                  const on = fontes.has(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setFontes((s) => toggle(s, id))}
                      className={clsx(
                        "text-xs-plus rounded-lg border px-3 py-1 transition-colors",
                        on
                          ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                          : "dark:border-dark-500 dark:text-dark-200 border-gray-300 text-gray-600 hover:border-gray-400",
                      )}
                    >
                      {nome}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="dark:text-dark-200 text-xs-plus font-medium text-gray-600">
                  Seções da análise{" "}
                  <span className="text-gray-400">(todas por padrão)</span>
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => marcarSecoes(true)}
                    className="dark:text-dark-200 dark:hover:bg-dark-600 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => marcarSecoes(false)}
                    className="dark:text-dark-200 dark:hover:bg-dark-600 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SECOES.map(([n, nome]) => {
                  const on = secoes.has(n);
                  return (
                    <label
                      key={n}
                      className={clsx(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                        on
                          ? "border-primary-500/60 bg-primary-500/5"
                          : "dark:border-dark-600 border-gray-200",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onChange={() => setSecoes((s) => toggle(s, n))}
                        className="size-3.5"
                      />
                      <span className="dark:text-dark-200 text-gray-700">
                        <b>{n}.</b> {nome}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {erro && (
              <div className="text-xs-plus rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {erro}
              </div>
            )}

            <div className="dark:border-dark-600 dark:bg-dark-700 sticky bottom-0 -mx-5 mt-1 flex justify-end border-t border-gray-100 bg-white px-5 pt-3 pb-1">
              <Button
                type="submit"
                color="primary"
                disabled={!podeEnviar}
                className="gap-2"
              >
                <MagnifyingGlassIcon className="size-5" />
                Analisar
              </Button>
            </div>
          </form>
        )}
      </div>
    </IaModalShell>
  );
}
