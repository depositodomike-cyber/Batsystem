// Import Dependencies
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Accordion, Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { gerarImagemApi, type ModeloImagem } from "@/services/api/imagem";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  AcoesEtapa,
  CAIXA_ERRO,
  CAMPO_SELECT,
  CAMPO_TEXTAREA,
  errMessage,
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
// Criar imagem — página do Lab (era janela). Motor OpenAI: prompt + controles
// por modelo (tamanho, qualidade, estilo, fundo, formato, nº) → grade de
// imagens com download. Salva em Minhas criações (as imagens só quando cabem
// num registro razoável; acima disso, só o pedido).
// ----------------------------------------------------------------------

const FALHA = "Falha ao gerar a imagem. Tente novamente.";

const MODELOS: [ModeloImagem, string][] = [
  ["gpt-image-1", "gpt-image-1 (completo)"],
  ["dall-e-3", "DALL·E 3"],
  ["dall-e-2", "DALL·E 2"],
];

const SIZES: Record<ModeloImagem, string[]> = {
  "gpt-image-1": ["1024x1024", "1536x1024", "1024x1536", "auto"],
  "dall-e-3": ["1024x1024", "1792x1024", "1024x1792"],
  "dall-e-2": ["256x256", "512x512", "1024x1024"],
};

/** Acima disso (em caracteres de data URL) as imagens não vão para a criação. */
const LIMITE_IMAGENS_NA_CRIACAO = 3_000_000;

type EtapaId = "descricao" | "configuracao";
const ETAPAS = [
  { id: "descricao" as const, numero: "01", titulo: "Descrição" },
  { id: "configuracao" as const, numero: "02", titulo: "Configuração" },
];

export default function ImagemPagina() {
  const [prompt, setPrompt] = useState("");
  const [modelo, setModelo] = useState<ModeloImagem>("gpt-image-1");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("auto"); // gpt-image-1: auto/low/medium/high · dall-e-3: standard/hd
  const [style, setStyle] = useState("vivid"); // dall-e-3
  const [background, setBackground] = useState("auto"); // gpt-image-1
  const [formato, setFormato] = useState("png"); // gpt-image-1
  const [n, setN] = useState(1);

  const [passo, setPasso] = useState<PassoLab>("form");
  const [regerando, setRegerando] = useState(false);
  const [erro, setErro] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);

  const design = useActiveDesignSystem();

  const sizes = SIZES[modelo];
  const sizeAtual = useMemo(
    () => (sizes.includes(size) ? size : sizes[0]),
    [sizes, size],
  );
  const maxN = modelo === "dall-e-3" ? 1 : 4;

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    descricao: prompt.trim().slice(0, 80) || undefined,
    configuracao: `${modelo} · ${sizeAtual} · ${n} ${n === 1 ? "imagem" : "imagens"}`,
  });

  const imagensCabem =
    imagens.reduce((t, s) => t + s.length, 0) <= LIMITE_IMAGENS_NA_CRIACAO;

  const criacao = useCriacaoLab({
    tipo: "imagem",
    passo,
    erro: Boolean(erro) && imagens.length === 0,
    relevante: prompt.trim().length >= 20 || imagens.length > 0,
    titulo: prompt.trim().slice(0, 80),
    dados: {
      prompt,
      modelo,
      size,
      quality,
      style,
      background,
      formato,
      n,
      imagens: imagensCabem ? imagens : [],
    },
    restaurar: (d) => {
      setPrompt(d.prompt ?? "");
      if (d.modelo) setModelo(d.modelo);
      if (d.size) setSize(d.size);
      if (d.quality) setQuality(d.quality);
      if (d.style) setStyle(d.style);
      if (d.background) setBackground(d.background);
      if (d.formato) setFormato(d.formato);
      if (d.n) setN(d.n);
      if (d.imagens?.length) {
        setImagens(d.imagens);
        setPasso("pronta");
      } else {
        etapas.resolverTodas();
      }
    },
  });

  const trocarModelo = (m: ModeloImagem) => {
    setModelo(m);
    setSize(SIZES[m][0]);
    setQuality(m === "dall-e-3" ? "standard" : "auto");
    if (m === "dall-e-3" && n > 1) setN(1);
  };

  const gerar = async () => {
    setErro("");
    if (!prompt.trim())
      return setErro("Descreva a imagem que você quer gerar.");
    const primeira = passo === "form";
    if (primeira) setPasso("gerando");
    else setRegerando(true);
    try {
      const data = await gerarImagemApi({
        prompt: prompt.trim(),
        modelo,
        size: sizeAtual,
        quality: modelo === "dall-e-2" ? undefined : quality,
        style: modelo === "dall-e-3" ? style : undefined,
        background: modelo === "gpt-image-1" ? background : undefined,
        formato: modelo === "gpt-image-1" ? formato : undefined,
        n: Math.min(maxN, Math.max(1, n)),
        design,
      });
      setImagens(data.images);
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err, FALHA));
      if (primeira) setPasso("form");
    } finally {
      setRegerando(false);
    }
  };

  const nova = () => {
    criacao.reiniciar();
    setImagens([]);
    setErro("");
    setPrompt("");
    setPasso("form");
    etapas.reiniciar();
  };

  const ext = () => {
    if (modelo !== "gpt-image-1") return "png";
    return formato === "jpeg" ? "jpg" : formato === "webp" ? "webp" : "png";
  };

  const baixar = (src: string, i: number) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `imagem-${i + 1}.${ext()}`;
    a.click();
  };

  const baixarTodas = () => imagens.forEach((src, i) => baixar(src, i));

  // As imagens voltam como data URLs — o fetch resolve para Blob sem rede.
  const prepararMemoria = async () => {
    const anexos = await Promise.all(
      imagens.map(async (src, i) => ({
        nome: `${i + 1}.${ext()}`,
        dados: await (await fetch(src)).blob(),
      })),
    );
    return {
      conteudo: `> **Prompt:** ${prompt.trim()}\n>\n> ${modelo} · ${sizeAtual}`,
      anexos,
    };
  };

  const select = (
    rotulo: string,
    valor: string | number,
    opcoes: (string | number)[],
    onChange: (v: string) => void,
    rotulos?: Record<string, string>,
    disabled = false,
  ) => (
    <div>
      <label className={ROTULO_CAMPO}>{rotulo}</label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${CAMPO_SELECT} rounded-lg disabled:opacity-60`}
      >
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {rotulos?.[String(o)] ?? o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <LabPagina
      titulo="Criar imagem"
      subtitulo="Você descreve a cena, a IA cria a imagem e você escolhe a melhor."
      Icone={PhotoIcon}
      tint="bg-amber-500/10 text-amber-500"
      ajuda={
        <>
          <p>
            Descreva a imagem com o máximo de detalhes: assunto, estilo, cores,
            enquadramento. A geração usa os modelos de imagem da OpenAI.
          </p>
          <p>
            Em <strong>Configuração</strong> você escolhe o modelo, o tamanho e
            quantas variações quer. Cada modelo oferece opções diferentes.
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
            <LabEtapa {...etapas.etapa("descricao")}>
              <PerguntaEtapa>Como é a imagem que você quer?</PerguntaEtapa>
              <MemoriaTextarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Ex.: um morcego geométrico prateado sobre fundo preto, estilo emblema, alta qualidade"
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />
              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("descricao")}
                desabilitado={!prompt.trim()}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("configuracao")}>
              <PerguntaEtapa>Modelo, tamanho e variações</PerguntaEtapa>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {select(
                  "Modelo",
                  modelo,
                  MODELOS.map(([id]) => id),
                  (v) => trocarModelo(v as ModeloImagem),
                  Object.fromEntries(MODELOS),
                )}
                {select("Tamanho", sizeAtual, sizes, setSize)}
                {select(
                  "Quantidade",
                  n,
                  Array.from({ length: maxN }, (_, i) => i + 1),
                  (v) => setN(Number(v)),
                  undefined,
                  maxN === 1,
                )}
                {modelo !== "dall-e-2" &&
                  select(
                    "Qualidade",
                    quality,
                    modelo === "dall-e-3"
                      ? ["standard", "hd"]
                      : ["auto", "low", "medium", "high"],
                    setQuality,
                  )}
                {modelo === "dall-e-3" &&
                  select("Estilo", style, ["vivid", "natural"], setStyle)}
                {modelo === "gpt-image-1" && (
                  <>
                    {select(
                      "Fundo",
                      background,
                      ["auto", "opaque", "transparent"],
                      setBackground,
                    )}
                    {select(
                      "Formato",
                      formato,
                      ["png", "jpeg", "webp"],
                      setFormato,
                    )}
                  </>
                )}
              </div>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("configuracao")}
              />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!prompt.trim()}
              className="h-10 gap-2 px-5"
            >
              <SparklesIcon className="size-5" />
              Gerar imagem
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Gerando a imagem…"
          descricao="A OpenAI está criando a imagem — pode levar alguns segundos."
        />
      )}

      {passo === "pronta" && imagens.length > 0 && (
        <LabResultado
          titulo={imagens.length === 1 ? "Imagem pronta" : "Imagens prontas"}
          descricao={prompt.trim()}
          detalhe={`${modelo} · ${sizeAtual}`}
          erro={erro}
          acoesSecundarias={
            <>
              <Button variant="flat" onClick={nova} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Nova imagem
              </Button>
              <Button
                variant="flat"
                onClick={() => {
                  toast("Gerando novas variações…");
                  void gerar();
                }}
                disabled={regerando}
                className="gap-1.5"
              >
                {regerando ? (
                  <Spinner className="size-4" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                Gerar de novo
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.imagem}
                titulo={prompt.trim().slice(0, 60) || "Imagem"}
                tags={["imagem"]}
                versao={imagens[0]?.slice(-32)}
                preparar={prepararMemoria}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="imagem"
                titulo={prompt.trim().slice(0, 60) || "Imagem"}
                versao={imagens[0]?.slice(-32)}
                preparar={prepararMemoria}
                className="h-10 px-5"
              />
              <Button
                color="primary"
                onClick={baixarTodas}
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" />
                {imagens.length === 1 ? "Baixar" : "Baixar todas"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {imagens.map((src, i) => (
              <div
                key={i}
                className="dark:border-dark-600 group relative overflow-hidden rounded-xl border border-gray-200"
              >
                <img
                  src={src}
                  alt={`Imagem ${i + 1}`}
                  className="w-full bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]"
                />
                <button
                  type="button"
                  onClick={() => baixar(src, i)}
                  className="absolute end-2 top-2 grid size-9 place-items-center rounded-lg bg-gray-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-900"
                  aria-label="Baixar"
                  title="Baixar"
                >
                  <ArrowDownTrayIcon className="size-5" />
                </button>
              </div>
            ))}
          </div>
          {!imagensCabem && (
            <p className="dark:text-dark-300 mt-3 text-xs text-gray-500">
              As imagens são grandes demais para Minhas criações: lá fica só o
              pedido. Baixe ou salve no Repositório para guardá-las.
            </p>
          )}
        </LabResultado>
      )}
    </LabPagina>
  );
}
