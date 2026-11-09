// Import Dependencies
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  SparklesIcon,
  ClipboardDocumentIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Accordion, Button } from "@/components/ui";
import {
  MemoriaTextarea,
  MemoriaInput,
} from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { melhorarTextoApi } from "@/services/api/melhorar";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { MarkdownView } from "./MarkdownView";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  AcoesEtapa,
  AJUDA_CAMPO,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_TEXTAREA,
  errMessage,
  LabAjuste,
  LabCarregando,
  LabEtapa,
  LabPagina,
  LabResultado,
  PerguntaEtapa,
  useCriacaoLab,
  useEtapasLab,
  type PassoLab,
} from "./lab";

// ----------------------------------------------------------------------
// Melhorar texto — página do Lab (era janela). Reescreve o texto (mais claro e
// forte) sem mudar o sentido. Itera: cada rodada substitui o texto e mostra o
// resumo das mudanças; "Desfazer" volta à versão anterior. Salva em Minhas
// criações.
// ----------------------------------------------------------------------

const FALHA = "Falha ao melhorar o texto. Tente novamente.";

type EtapaId = "texto" | "instrucoes";
const ETAPAS = [
  { id: "texto" as const, numero: "01", titulo: "Texto" },
  { id: "instrucoes" as const, numero: "02", titulo: "Instruções" },
];

export default function MelhorarPagina() {
  const [texto, setTexto] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [resumo, setResumo] = useState("");
  // Bloco "🔗 Conexões no Vault" da última reescrita — só entra na nota do
  // Repositório, nunca no texto (senão voltaria como texto na próxima rodada).
  const [conexoes, setConexoes] = useState("");
  const [anterior, setAnterior] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState("");
  const [passo, setPasso] = useState<PassoLab>("form");
  const [refinando, setRefinando] = useState(false);
  const [erro, setErro] = useState("");

  const design = useActiveDesignSystem();

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    texto: texto.trim()
      ? `${texto.trim().split(/\s+/).length} palavras`
      : undefined,
    instrucoes: instrucoes.trim() || "Sem instruções — a IA decide",
  });

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota).
  useEffect(() => {
    const pre = takeIaPrefill("melhorar");
    if (pre?.texto) setTexto(pre.texto);
  }, []);

  // Não há título nesta ação — usa a primeira linha do texto.
  const titulo =
    texto.trim().split("\n")[0]?.slice(0, 60).trim() || "Texto melhorado";

  const criacao = useCriacaoLab({
    tipo: "melhorar",
    passo,
    erro: Boolean(erro) && passo === "form",
    relevante: texto.trim().length >= 20,
    titulo,
    dados: { texto, instrucoes, resumo, conexoes, anterior },
    restaurar: (d) => {
      setTexto(d.texto ?? "");
      setInstrucoes(d.instrucoes ?? "");
      setResumo(d.resumo ?? "");
      setConexoes(d.conexoes ?? "");
      setAnterior(d.anterior ?? null);
      if (d.resumo) setPasso("pronta");
    },
  });

  /** Uma rodada de reescrita. `extra` = instrução da rodada (ajuste). */
  const rodar = async (extra?: string) => {
    setErro("");
    if (!texto.trim()) return setErro("Cole um texto para melhorar.");
    const primeira = passo === "form";
    if (primeira) setPasso("gerando");
    else setRefinando(true);
    try {
      const data = await melhorarTextoApi({
        texto: texto.trim(),
        instrucoes: (extra ?? instrucoes).trim() || undefined,
        design,
      });
      setAnterior(texto);
      setTexto(data.texto);
      setResumo(data.resumo);
      setConexoes((data.conexoes || "").trim());
      setAjuste("");
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err, FALHA));
      if (primeira) setPasso("form");
    } finally {
      setRefinando(false);
    }
  };

  const desfazer = () => {
    if (anterior === null) return;
    setTexto(anterior);
    setAnterior(null);
    setResumo("");
    setConexoes("");
    setPasso("form");
  };

  const novo = () => {
    criacao.reiniciar();
    setTexto("");
    setInstrucoes("");
    setResumo("");
    setConexoes("");
    setAnterior(null);
    setAjuste("");
    setErro("");
    setPasso("form");
    etapas.reiniciar();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast("Copiado", { description: "Texto na área de transferência." });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  return (
    <LabPagina
      titulo="Melhorar texto"
      subtitulo="Você traz o texto, a IA reescreve com mais clareza sem mudar o sentido."
      Icone={SparklesIcon}
      tint="bg-teal-500/10 text-teal-500"
      ajuda={
        <>
          <p>
            Cole o texto e, se quiser, diga como ele deve ficar: mais formal,
            mais curto, mais persuasivo. A IA reescreve e mostra o resumo das
            mudanças.
          </p>
          <p>
            Dá para iterar: peça um ajuste e a IA refaz a partir da última
            versão. <strong>Desfazer</strong> volta à versão anterior.
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
            void rodar();
          }}
        >
          <Accordion {...etapas.accordion} className="flex flex-col gap-3">
            <LabEtapa {...etapas.etapa("texto")}>
              <PerguntaEtapa>Qual texto você quer melhorar?</PerguntaEtapa>
              <MemoriaTextarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                placeholder="Cole aqui o texto que você quer melhorar…"
                className={`${CAMPO_TEXTAREA} rounded-lg leading-relaxed`}
              />
              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("texto")}
                desabilitado={!texto.trim()}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("instrucoes")} pendenteLabel="Opcional">
              <PerguntaEtapa>Como o texto deve ficar?</PerguntaEtapa>
              <MemoriaInput
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                placeholder="Ex.: deixar mais formal, mais curto, mais persuasivo…"
                className={`${CAMPO} rounded-lg`}
              />
              <p className={AJUDA_CAMPO}>
                Em branco, a IA só deixa o texto mais claro e forte.
              </p>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("instrucoes")}
              />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!texto.trim()}
              className="h-10 gap-2 px-5"
            >
              <SparklesIcon className="size-5" />
              Melhorar texto
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Melhorando o texto…"
          descricao="A IA está reescrevendo com mais clareza, sem mudar o sentido."
        />
      )}

      {passo === "pronta" && (
        <LabResultado
          titulo="Texto melhorado"
          descricao={
            resumo ? (
              <>
                <span className="font-medium">Mudanças:</span> {resumo}
              </>
            ) : undefined
          }
          erro={erro}
          acoesSecundarias={
            <>
              {anterior !== null && (
                <Button
                  variant="flat"
                  onClick={desfazer}
                  disabled={refinando}
                  className="gap-1.5"
                >
                  <ArrowUturnLeftIcon className="size-4" /> Desfazer
                </Button>
              )}
              <Button variant="flat" onClick={novo} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Novo texto
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.melhorar}
                titulo={titulo}
                conteudo={conexoes ? `${texto}\n\n${conexoes}\n` : texto}
                tags={["texto"]}
                disabled={!texto.trim() || refinando}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="melhorar"
                titulo={titulo}
                conteudo={texto}
                disabled={!texto.trim() || refinando}
                className="h-10 px-5"
              />
              <Button
                color="primary"
                onClick={() => void copiar()}
                disabled={!texto.trim()}
                className="h-10 gap-2 px-5"
              >
                <ClipboardDocumentIcon className="size-5" /> Copiar texto
              </Button>
            </>
          }
        >
          <MemoriaTextarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={12}
            className={`${CAMPO_TEXTAREA} rounded-lg leading-relaxed`}
          />

          {/* Conexões que vão junto da nota (não entram no texto copiado). */}
          {conexoes && (
            <div className="dark:border-dark-600 dark:bg-dark-800/40 mt-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <MarkdownView>{conexoes}</MarkdownView>
              <p className="dark:text-dark-300 mt-1 text-xs text-gray-400">
                Vai junto ao salvar no Repositório.
              </p>
            </div>
          )}

          <div className="mt-4">
            <LabAjuste
              valor={ajuste}
              onChange={setAjuste}
              onRefazer={() => void rodar(ajuste)}
              refinando={refinando}
              placeholder="Ex.: mais curto, mais direto, tom mais pessoal…"
            />
          </div>
        </LabResultado>
      )}
    </LabPagina>
  );
}
