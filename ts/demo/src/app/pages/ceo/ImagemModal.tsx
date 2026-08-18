// Import Dependencies
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PhotoIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { gerarImagemApi, type ModeloImagem } from "@/services/api/imagem";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar imagem — portado do beculture/Confi (motor OpenAI). Prompt + controles
// por modelo (tamanho, qualidade, estilo, fundo, formato, nº) → grade de
// imagens com download. O provedor HeyGen (foto de pessoas) fica para depois.
// ----------------------------------------------------------------------

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

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar a imagem. Tente novamente.";
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function ImagemModal({ isOpen, close, onMinimize }: Props) {
  const [prompt, setPrompt] = useState("");
  const [modelo, setModelo] = useState<ModeloImagem>("gpt-image-1");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("auto"); // gpt-image-1: auto/low/medium/high · dall-e-3: standard/hd
  const [style, setStyle] = useState("vivid"); // dall-e-3
  const [background, setBackground] = useState("auto"); // gpt-image-1
  const [formato, setFormato] = useState("png"); // gpt-image-1
  const [n, setN] = useState(1);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  const sizes = SIZES[modelo];
  const sizeAtual = useMemo(
    () => (sizes.includes(size) ? size : sizes[0]),
    [sizes, size],
  );
  const maxN = modelo === "dall-e-3" ? 1 : 4;

  const trocarModelo = (m: ModeloImagem) => {
    setModelo(m);
    setSize(SIZES[m][0]);
    setQuality(m === "dall-e-3" ? "standard" : "auto");
    if (m === "dall-e-3" && n > 1) setN(1);
  };

  const fechar = () => {
    if (loading) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!prompt.trim())
      return setErro("Descreva a imagem que você quer gerar.");
    setLoading(true);
    setImagens([]);
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
      toast("Imagem gerada", {
        description: `${data.images.length} imagem(ns).`,
      });
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
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

  return (
    <IaModalShell
      isOpen={isOpen}
      close={fechar}
      onMinimize={onMinimize}
      closeDisabled={loading}
      title="IA · Criar imagem"
      icon={PhotoIcon}
    >
      <div>
        <div className="flex flex-col gap-3">
          <DesignSystemBar />

          <div>
            <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
              Descrição (prompt) <span className="text-rose-500">*</span>
            </label>
            <MemoriaTextarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Ex.: um mascote coruja minimalista, fundo âmbar, estilo flat, alta qualidade"
              className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Modelo
              </label>
              <select
                value={modelo}
                onChange={(e) => trocarModelo(e.target.value as ModeloImagem)}
                className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
              >
                {MODELOS.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Tamanho
              </label>
              <select
                value={sizeAtual}
                onChange={(e) => setSize(e.target.value)}
                className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                Quantidade
              </label>
              <select
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                disabled={maxN === 1}
                className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm disabled:opacity-60"
              >
                {Array.from({ length: maxN }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Qualidade — gpt-image-1 e dall-e-3 */}
            {modelo !== "dall-e-2" && (
              <div>
                <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                  Qualidade
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                >
                  {(modelo === "dall-e-3"
                    ? ["standard", "hd"]
                    : ["auto", "low", "medium", "high"]
                  ).map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Estilo — dall-e-3 */}
            {modelo === "dall-e-3" && (
              <div>
                <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                  Estilo
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                >
                  {["vivid", "natural"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fundo + formato — gpt-image-1 */}
            {modelo === "gpt-image-1" && (
              <>
                <div>
                  <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                    Fundo
                  </label>
                  <select
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {["auto", "opaque", "transparent"].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
                    Formato
                  </label>
                  <select
                    value={formato}
                    onChange={(e) => setFormato(e.target.value)}
                    className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                  >
                    {["png", "jpeg", "webp"].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {erro && (
            <div className="text-xs-plus rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
              {erro}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={gerar}
              color="primary"
              disabled={!prompt.trim() || loading}
              className="gap-2"
            >
              {loading ? (
                <Spinner className="size-5" />
              ) : (
                <SparklesIcon className="size-5" />
              )}
              Gerar imagem
            </Button>
          </div>

          {loading && (
            <p className="dark:text-dark-300 text-center text-xs text-gray-400">
              Gerando na OpenAI — pode levar alguns segundos…
            </p>
          )}

          {/* Resultado */}
          {imagens.length > 0 && (
            <div className="dark:border-dark-600 mt-1 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
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
          )}

          {imagens.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outlined"
                onClick={() => setImagens([])}
                className="gap-1.5"
              >
                <ArrowPathIcon className="size-4" /> Limpar
              </Button>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.imagem}
                titulo={prompt.trim().slice(0, 60) || "Imagem"}
                tags={["imagem"]}
                versao={imagens[0]?.slice(-32)}
                preparar={prepararMemoria}
                className="h-auto"
              />
              <EnviarParaGrupoButton
                funcao="imagem"
                titulo={prompt.trim().slice(0, 60) || "Imagem"}
                versao={imagens[0]?.slice(-32)}
                preparar={prepararMemoria}
                className="h-auto"
              />
            </div>
          )}
        </div>
      </div>
    </IaModalShell>
  );
}
