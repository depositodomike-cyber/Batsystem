// Import Dependencies
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Accordion, Button, Checkbox } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
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
import {
  AcoesEtapa,
  AJUDA_CAMPO,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_SELECT,
  CAMPO_TEXTAREA,
  LabArquivo,
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

// ----------------------------------------------------------------------
// Análise de conteúdo — página do Lab (era janela). Arquivo/link, objetivo,
// descrição, viés, fontes e as 17 seções; progresso por fases; resultado em
// Markdown; exportar (.md / imprimir / copiar). Salva em Minhas criações (o
// arquivo enviado não é guardado; o link e o relatório, sim).
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

type EtapaId = "conteudo" | "objetivo" | "secoes";
const ETAPAS = [
  { id: "conteudo" as const, numero: "01", titulo: "Conteúdo" },
  { id: "objetivo" as const, numero: "02", titulo: "Objetivo e foco" },
  { id: "secoes" as const, numero: "03", titulo: "Seções da análise" },
];

export default function AnalisePagina() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vies, setVies] = useState("ambos");
  const [fontes, setFontes] = useState<Set<string>>(new Set());
  const [secoes, setSecoes] = useState<Set<string>>(
    new Set(SECOES.map(([n]) => n)),
  );

  const [passo, setPasso] = useState<PassoLab>("form");
  const [erro, setErro] = useState("");
  const [result, setResult] = useState<AnaliseResult | null>(null);

  const design = useActiveDesignSystem();
  const prog = useProgresso(passo === "gerando", fontes.size > 0, secoes.size);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    conteudo: arquivo?.name || link.trim() || undefined,
    objetivo: objetivo.trim().slice(0, 80) || undefined,
    secoes: `${secoes.size} de ${SECOES.length} seções`,
  });

  const criacao = useCriacaoLab({
    tipo: "analise",
    passo,
    erro: Boolean(erro) && !result,
    relevante: objetivo.trim().length >= 20 || result != null,
    titulo: result?.titulo || objetivo.trim().slice(0, 80),
    dados: {
      link,
      objetivo,
      descricao,
      vies,
      fontes: [...fontes],
      secoes: [...secoes],
      result,
    },
    restaurar: (d) => {
      setLink(d.link ?? "");
      setObjetivo(d.objetivo ?? "");
      setDescricao(d.descricao ?? "");
      if (d.vies) setVies(d.vies);
      if (d.fontes) setFontes(new Set(d.fontes));
      if (d.secoes) setSecoes(new Set(d.secoes));
      if (d.result) {
        setResult(d.result);
        setPasso("pronta");
      }
    },
  });

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const temConteudo = Boolean(arquivo) || Boolean(link.trim());
  const podeEnviar = useMemo(
    () => temConteudo && !!objetivo.trim() && secoes.size > 0,
    [temConteudo, objetivo, secoes],
  );

  const submeter = async () => {
    setErro("");
    if (!temConteudo) return setErro("Envie um arquivo ou informe um link.");
    if (!objetivo.trim()) return setErro("Descreva o objetivo da análise.");
    if (secoes.size === 0)
      return setErro("Selecione ao menos uma seção da análise.");
    prog.resetar();
    setPasso("gerando");
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
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err));
      setPasso("form");
    }
  };

  const novaAnalise = () => {
    criacao.reiniciar();
    setResult(null);
    setErro("");
    setArquivo(null);
    setLink("");
    setObjetivo("");
    setDescricao("");
    setPasso("form");
    etapas.reiniciar();
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

  const marcarSecoes = (v: boolean) =>
    setSecoes(v ? new Set(SECOES.map(([n]) => n)) : new Set());

  const conteudoNota = result
    ? `${result.origem ? `> Origem: ${result.origem}\n\n` : ""}${result.analise}`
    : "";

  return (
    <LabPagina
      titulo="Análise de conteúdo"
      subtitulo="Você traz o material e o objetivo, a IA analisa em até 17 seções."
      Icone={MagnifyingGlassIcon}
      tint="bg-sky-500/10 text-sky-500"
      ajuda={
        <>
          <p>
            Envie um arquivo (.txt, .md, .pdf, .docx, .csv…) ou informe um link,
            e diga o que você quer descobrir. A IA produz um relatório em
            Markdown com as seções escolhidas.
          </p>
          <p>
            Dá para cruzar com o Repositório, as Notas, os Insights e os
            To-do&apos;s, e escolher o viés: qualitativo, quantitativo ou os
            dois.
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
            void submeter();
          }}
        >
          <Accordion {...etapas.accordion} className="flex flex-col gap-3">
            <LabEtapa {...etapas.etapa("conteudo")}>
              <PerguntaEtapa>O que você quer analisar?</PerguntaEtapa>
              <LabArquivo arquivo={arquivo} onChange={setArquivo} accept={ACCEPT} />
              <p className={AJUDA_CAMPO}>.txt, .md, .pdf, .docx, .csv…</p>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Ou um link{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (o arquivo tem prioridade)
                  </span>
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  className={`${CAMPO} rounded-lg`}
                />
              </div>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Qual o conteúdo do arquivo ou link{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (opcional)
                  </span>
                </label>
                <MemoriaTextarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  placeholder="Ex.: extrato do cartão, artigo de opinião, transcrição…"
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("conteudo")}
                desabilitado={!temConteudo}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("objetivo")}>
              <PerguntaEtapa>O que você quer descobrir?</PerguntaEtapa>
              <MemoriaTextarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={3}
                placeholder="Ex.: onde estou gastando mais do que deveria e o que dá para cortar"
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={ROTULO_CAMPO}>Viés de análise</label>
                  <select
                    value={vies}
                    onChange={(e) => setVies(e.target.value)}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    <option value="ambos">Ambos (qualitativa + quantitativa)</option>
                    <option value="qualitativa">Qualitativa</option>
                    <option value="quantitativa">Quantitativa</option>
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Relacionar com{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (opcional)
                  </span>
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
                          "text-xs-plus rounded-lg border px-3 py-1.5 transition-colors",
                          on
                            ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                            : "dark:border-dark-450 dark:text-dark-100 border-gray-300 text-gray-700 hover:border-gray-400",
                        )}
                      >
                        {nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("objetivo")}
                desabilitado={!objetivo.trim()}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("secoes")}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <PerguntaEtapa className="">
                  Quais seções o relatório deve ter?
                </PerguntaEtapa>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="flat"
                    onClick={() => marcarSecoes(true)}
                    className="h-8 px-2.5 text-xs"
                  >
                    Todas
                  </Button>
                  <Button
                    type="button"
                    variant="flat"
                    onClick={() => marcarSecoes(false)}
                    className="h-8 px-2.5 text-xs"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SECOES.map(([n, nome]) => {
                  const on = secoes.has(n);
                  return (
                    <label
                      key={n}
                      className={clsx(
                        "text-xs-plus flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                        on
                          ? "border-primary-500/60 bg-primary-500/5"
                          : "dark:border-dark-600 border-gray-200",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onChange={() => setSecoes((s) => toggle(s, n))}
                        className="size-4"
                      />
                      <span className="dark:text-dark-100 text-gray-700">
                        <b>{n}.</b> {nome}
                      </span>
                    </label>
                  );
                })}
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("secoes")}
                desabilitado={secoes.size === 0}
              />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!podeEnviar}
              className="h-10 gap-2 px-5"
            >
              <MagnifyingGlassIcon className="size-5" />
              Analisar
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo={prog.fase}
          descricao="A análise pode levar de alguns segundos a cerca de 1 minuto."
        >
          <div className="mt-2 w-full max-w-sm">
            <div className="dark:bg-dark-500 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="bg-primary-500 h-full rounded-lg transition-[width] duration-300 ease-out"
                style={{ width: `${prog.pct.toFixed(1)}%` }}
              />
            </div>
            <p className="dark:text-dark-300 mt-1.5 text-xs text-gray-400 tabular-nums">
              {prog.tempo}
            </p>
          </div>
        </LabCarregando>
      )}

      {passo === "pronta" && result && (
        <LabResultado
          titulo={result.titulo || "Análise pronta"}
          descricao={result.origem ? `Origem: ${result.origem}` : undefined}
          erro={erro}
          acoesSecundarias={
            <>
              <Button variant="flat" onClick={novaAnalise} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Nova análise
              </Button>
              <Button
                variant="flat"
                onClick={() => void copiar()}
                className="gap-1.5"
              >
                <ClipboardDocumentIcon className="size-4" /> Copiar
              </Button>
              <Button variant="flat" onClick={imprimir} className="gap-1.5">
                <PrinterIcon className="size-4" /> Imprimir
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.analise}
                titulo={result.titulo}
                conteudo={conteudoNota}
                tags={["análise"]}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="analise"
                titulo={result.titulo}
                conteudo={conteudoNota}
                className="h-10 px-5"
              />
              <Button
                color="primary"
                onClick={baixarMd}
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" /> Baixar .md
              </Button>
            </>
          }
        >
          <div
            ref={resultRef}
            className="dark:border-dark-600 rounded-xl border border-gray-200 p-5 sm:p-6"
          >
            <MarkdownView>{result.analise}</MarkdownView>
          </div>
        </LabResultado>
      )}
    </LabPagina>
  );
}
