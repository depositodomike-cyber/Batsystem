// Import Dependencies
import { useState } from "react";
import { toast } from "sonner";
import {
  ClipboardDocumentListIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Accordion, Button, Checkbox } from "@/components/ui";
import {
  MemoriaTextarea,
  MemoriaInput,
} from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { MarkdownView } from "./MarkdownView";
import { gerarAtaApi } from "@/services/api/ata";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import { nomesDeParticipantes } from "@/utils/memoriaVault";
import {
  AcoesEtapa,
  AJUDA_CAMPO,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_TEXTAREA,
  errMessage,
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
// Criar Ata — página do Lab (era janela). Sobe um arquivo (ou cola a
// transcrição) → a IA redige uma ata executiva editável. Opção "Repositório"
// formata com frontmatter + [[wikilinks]] às regras existentes. Salva em
// Minhas criações (o texto; o arquivo enviado não é guardado).
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";
const FALHA = "Falha ao criar a ata. Tente novamente.";

type EtapaId = "material" | "formato";
const ETAPAS = [
  { id: "material" as const, numero: "01", titulo: "Material da reunião" },
  { id: "formato" as const, numero: "02", titulo: "Instruções e formato" },
];

export default function AtaPagina() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [memoria, setMemoria] = useState(false);

  const [passo, setPasso] = useState<PassoLab>("form");
  const [erro, setErro] = useState("");

  const [titulo, setTitulo] = useState("");
  const [ata, setAta] = useState<string | null>(null);
  const [aba, setAba] = useState<"previa" | "editar">("previa");

  const design = useActiveDesignSystem();

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    material: arquivo
      ? arquivo.name
      : texto.trim()
        ? `Texto colado · ${texto.trim().split(/\s+/).length} palavras`
        : undefined,
    formato: [
      instrucoes.trim() || "Sem instruções",
      memoria ? "formatada para o Repositório" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  const criacao = useCriacaoLab({
    tipo: "ata",
    passo,
    erro: Boolean(erro) && ata === null,
    relevante: texto.trim().length >= 20 || ata !== null,
    titulo: titulo || (arquivo?.name ?? ""),
    dados: { texto, instrucoes, memoria, titulo, ata },
    restaurar: (d) => {
      setTexto(d.texto ?? "");
      setInstrucoes(d.instrucoes ?? "");
      setMemoria(Boolean(d.memoria));
      setTitulo(d.titulo ?? "");
      if (d.ata != null) {
        setAta(d.ata);
        setPasso("pronta");
      }
    },
  });

  const gerar = async () => {
    setErro("");
    if (!arquivo && !texto.trim())
      return setErro("Envie um arquivo ou cole o conteúdo da reunião.");
    setPasso("gerando");
    try {
      const data = await gerarAtaApi({
        arquivo,
        texto: texto.trim() || undefined,
        instrucoes: instrucoes.trim() || undefined,
        memoria,
        design,
      });
      setTitulo(data.titulo);
      setAta(data.ata);
      setAba("previa");
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err, FALHA));
      setPasso("form");
    }
  };

  const nova = () => {
    criacao.reiniciar();
    setAta(null);
    setTitulo("");
    setErro("");
    setArquivo(null);
    setTexto("");
    setInstrucoes("");
    setPasso("form");
    etapas.reiniciar();
  };

  const docCompleto = () => `# ${titulo}\n\n${ata ?? ""}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(docCompleto());
      toast("Copiado", {
        description: "Ata copiada para a área de transferência.",
      });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixar = () => {
    const blob = new Blob([docCompleto()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "ata"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const temMaterial = Boolean(arquivo) || Boolean(texto.trim());

  return (
    <LabPagina
      titulo="Criar ata"
      subtitulo="Você traz a reunião, a IA redige a ata e você revisa."
      Icone={ClipboardDocumentListIcon}
      tint="bg-emerald-500/10 text-emerald-500"
      ajuda={
        <>
          <p>
            Envie o arquivo da reunião (.txt, .md, .pdf, .docx…) ou cole a
            transcrição ou as anotações. A IA redige uma ata executiva com
            decisões, responsáveis e prazos.
          </p>
          <p>
            A ata pronta é editável: alterne entre <strong>Prévia</strong> e{" "}
            <strong>Editar</strong> antes de salvar no Repositório.
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
            <LabEtapa {...etapas.etapa("material")}>
              <PerguntaEtapa>De qual reunião é a ata?</PerguntaEtapa>
              <LabArquivo
                arquivo={arquivo}
                onChange={setArquivo}
                accept={ACCEPT}
                rotulo="Carregar arquivo da reunião"
              />
              <p className={AJUDA_CAMPO}>.txt, .md, .pdf, .docx, .csv…</p>

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Ou cole o conteúdo{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (transcrição ou anotações)
                  </span>
                </label>
                <MemoriaTextarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={6}
                  placeholder="Cole aqui a transcrição ou as anotações da reunião…"
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("material")}
                desabilitado={!temMaterial}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("formato")} pendenteLabel="Opcional">
              <PerguntaEtapa>Algo a destacar na ata?</PerguntaEtapa>
              <MemoriaInput
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                placeholder="Ex.: foco nas decisões, tom mais formal, destacar prazos…"
                className={`${CAMPO} rounded-lg`}
              />

              <label className="dark:text-dark-100 mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={memoria}
                  onChange={(e) => setMemoria(e.target.checked)}
                  className="size-4"
                />
                Formatar para o Repositório
                <span className="dark:text-dark-300 text-gray-400">
                  (frontmatter + [[relacionamentos]])
                </span>
              </label>

              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa onContinuar={() => etapas.concluirEtapa("formato")} />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!temMaterial}
              className="h-10 gap-2 px-5"
            >
              <ClipboardDocumentListIcon className="size-5" />
              Criar ata
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Redigindo a ata…"
          descricao="A IA está organizando decisões, responsáveis e prazos."
        />
      )}

      {passo === "pronta" && ata !== null && (
        <LabResultado
          titulo="Ata pronta"
          descricao="Revise, ajuste o título e o texto, e salve."
          erro={erro}
          acoesSecundarias={
            <>
              <Button variant="flat" onClick={nova} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Nova ata
              </Button>
              <Button
                variant="flat"
                onClick={() => void copiar()}
                className="gap-1.5"
              >
                <ClipboardDocumentIcon className="size-4" /> Copiar
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.ata}
                titulo={titulo}
                conteudo={ata}
                tags={["ata", "reunião"]}
                pessoas={nomesDeParticipantes(ata)}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="ata"
                titulo={titulo}
                conteudo={ata}
                className="h-10 px-5"
              />
              <Button
                color="primary"
                onClick={baixar}
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" /> Baixar .md
              </Button>
            </>
          }
        >
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={`${CAMPO} rounded-lg text-base font-semibold`}
            placeholder="Título da ata"
          />

          {/* Abas Prévia / Editar */}
          <div className="dark:border-dark-600 mt-4 mb-3 flex gap-1 border-b border-gray-200">
            {(["previa", "editar"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAba(k)}
                className={clsx(
                  "text-xs-plus flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition-colors",
                  aba === k
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "dark:text-dark-300 border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {k === "previa" ? (
                  <EyeIcon className="size-4" />
                ) : (
                  <PencilSquareIcon className="size-4" />
                )}
                {k === "previa" ? "Prévia" : "Editar"}
              </button>
            ))}
          </div>

          {aba === "previa" ? (
            <div className="dark:border-dark-600 rounded-xl border border-gray-200 p-5 sm:p-6">
              <MarkdownView>{ata}</MarkdownView>
            </div>
          ) : (
            <MemoriaTextarea
              value={ata}
              onChange={(e) => setAta(e.target.value)}
              rows={18}
              className={`${CAMPO_TEXTAREA} text-xs-plus rounded-lg font-mono leading-relaxed`}
            />
          )}
        </LabResultado>
      )}
    </LabPagina>
  );
}
