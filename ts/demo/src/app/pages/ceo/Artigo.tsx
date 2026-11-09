// Import Dependencies
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Accordion, Button, Checkbox } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { MarkdownView } from "./MarkdownView";
import { gerarArtigoApi, type Artigo } from "@/services/api/artigo";
import { takeIaPrefill } from "@/utils/iaPrefill";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
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

// ----------------------------------------------------------------------
// Criar artigo — página do Lab (era janela). Geração direta (tema + contexto +
// Repositório) e refino iterativo (peça um ajuste; a IA refaz preservando o
// bom). Salva em Minhas criações.
// ----------------------------------------------------------------------

const FALHA = "Falha ao gerar o artigo. Tente novamente.";

type EtapaId = "sobre";
const ETAPAS = [{ id: "sobre" as const, numero: "01", titulo: "Sobre o artigo" }];

export default function ArtigoPagina() {
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [usarMemoria, setUsarMemoria] = useState(false);

  const [passo, setPasso] = useState<PassoLab>("form");
  const [refinando, setRefinando] = useState(false);
  const [erro, setErro] = useState("");
  const [artigo, setArtigo] = useState<Artigo | null>(null);
  const [ajuste, setAjuste] = useState("");

  const design = useActiveDesignSystem();
  const etapas = useEtapasLab<EtapaId>(ETAPAS);

  // Prefill vindo de outra tela (ex.: ação de IA de uma nota).
  useEffect(() => {
    const pre = takeIaPrefill("artigo");
    if (pre?.tema) setTema(pre.tema);
    if (pre?.contexto) setContexto(pre.contexto);
  }, []);

  const criacao = useCriacaoLab({
    tipo: "artigo",
    passo,
    erro: Boolean(erro) && !artigo,
    relevante: tema.trim().length >= 20 || artigo != null,
    titulo: artigo?.titulo || tema.trim().slice(0, 80),
    dados: { tema, contexto, usarMemoria, artigo },
    restaurar: (d) => {
      setTema(d.tema ?? "");
      setContexto(d.contexto ?? "");
      setUsarMemoria(Boolean(d.usarMemoria));
      if (d.artigo) {
        setArtigo(d.artigo);
        setPasso("pronta");
      }
    },
  });

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o tema do artigo.");
    setPasso("gerando");
    try {
      const data = await gerarArtigoApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
      });
      setArtigo(data);
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err, FALHA));
      setPasso("form");
    }
  };

  const refazer = async () => {
    if (!artigo || !ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const data = await gerarArtigoApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
        ajuste: ajuste.trim(),
        anterior: artigo,
      });
      setArtigo(data);
      setAjuste("");
    } catch (err) {
      setErro(errMessage(err, FALHA));
    } finally {
      setRefinando(false);
    }
  };

  const novo = () => {
    criacao.reiniciar();
    setArtigo(null);
    setAjuste("");
    setErro("");
    setTema("");
    setContexto("");
    setPasso("form");
    etapas.reiniciar();
  };

  const markdownCompleto = (a: Artigo) =>
    `# ${a.titulo}\n${a.subtitulo ? `\n*${a.subtitulo}*\n` : ""}\n${a.conteudo}`;

  // Corpo da nota do Repositório: artigo + bloco "🔗 Conexões no Vault".
  const notaMemoria = (a: Artigo) =>
    `${a.subtitulo ? `*${a.subtitulo}*\n\n` : ""}${a.conteudo}` +
    (a.conexoes?.trim() ? `\n\n${a.conexoes.trim()}\n` : "");

  const copiar = async () => {
    if (!artigo) return;
    try {
      await navigator.clipboard.writeText(markdownCompleto(artigo));
      toast("Copiado", {
        description: "Artigo copiado para a área de transferência.",
      });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixar = () => {
    if (!artigo) return;
    // O .md costuma ir para o vault — leva o bloco de conexões junto.
    const md =
      markdownCompleto(artigo) +
      (artigo.conexoes?.trim() ? `\n\n${artigo.conexoes.trim()}\n` : "");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artigo.titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "artigo"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <LabPagina
      titulo="Criar artigo"
      subtitulo="Você define o tema, a IA escreve e você refina até ficar do seu jeito."
      Icone={DocumentTextIcon}
      tint="bg-blue-500/10 text-blue-500"
      ajuda={
        <>
          <p>
            Descreva o <strong>tema</strong> e, se quiser, o contexto: público,
            tom, pontos que não podem faltar. A IA escreve o artigo completo em
            Markdown.
          </p>
          <p>
            Com o artigo pronto, use <strong>Peça um ajuste</strong> para
            refinar em português — a IA refaz preservando o que já estava bom.
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
            <LabEtapa {...etapas.etapa("sobre")}>
              <PerguntaEtapa>Sobre o que é o artigo?</PerguntaEtapa>
              <MemoriaTextarea
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                rows={3}
                placeholder="Ex.: Como conduzir reuniões que geram decisões"
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />

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
                  rows={3}
                  placeholder="Público, tom, pontos que não podem faltar, extensão desejada…"
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
                <p className={AJUDA_CAMPO}>
                  Quanto mais contexto, mais o artigo soa como você.
                </p>
              </div>

              <label className="dark:text-dark-100 mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={usarMemoria}
                  onChange={(e) => setUsarMemoria(e.target.checked)}
                  className="size-4"
                />
                Usar o Repositório como referência
              </label>

              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
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
              <DocumentTextIcon className="size-5" />
              Gerar artigo
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Escrevendo o artigo…"
          descricao="A IA está organizando as ideias e redigindo o texto."
        />
      )}

      {passo === "pronta" && artigo && (
        <LabResultado
          titulo="Artigo pronto"
          descricao="Revise o texto abaixo e peça ajustes se quiser."
          erro={erro}
          acoesSecundarias={
            <>
              <Button variant="flat" onClick={novo} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Novo artigo
              </Button>
              <Button variant="flat" onClick={copiar} className="gap-1.5">
                <ClipboardDocumentIcon className="size-4" /> Copiar
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.artigo}
                titulo={artigo.titulo}
                conteudo={notaMemoria(artigo)}
                tags={["artigo"]}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="artigo"
                titulo={artigo.titulo}
                conteudo={`${artigo.subtitulo ? `*${artigo.subtitulo}*\n\n` : ""}${artigo.conteudo}`}
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
          <div className="dark:border-dark-600 rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="dark:text-dark-50 text-2xl font-bold text-gray-800">
              {artigo.titulo}
            </h2>
            {artigo.subtitulo && (
              <p className="dark:text-dark-300 mt-1 text-base text-gray-500">
                {artigo.subtitulo}
              </p>
            )}
            <div className="dark:border-dark-600 mt-3 border-t border-gray-100 pt-3">
              <MarkdownView>{artigo.conteudo}</MarkdownView>
            </div>
            {artigo.conexoes?.trim() && (
              <div className="dark:border-dark-600 mt-4 border-t border-gray-100 pt-3">
                <MarkdownView>{artigo.conexoes.trim()}</MarkdownView>
              </div>
            )}
          </div>

          <div className="mt-4">
            <LabAjuste
              valor={ajuste}
              onChange={setAjuste}
              onRefazer={() => void refazer()}
              refinando={refinando}
            />
          </div>
        </LabResultado>
      )}
    </LabPagina>
  );
}
