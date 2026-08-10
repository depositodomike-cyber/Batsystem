import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MicrophoneIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

import { Button, Spinner } from "@/components/ui";
import { MarkdownView } from "./MarkdownView";
import { SugerirPosUploadModal } from "./SugerirPosUpload";
import { transcreverAudioApi } from "@/services/api/audio";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Conteúdo da aba "Áudio" do UploadModal.
// ----------------------------------------------------------------------

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao transcrever o áudio. Tente novamente.";
}

export interface AudioUploadPanelProps {
  onBusyChange?: (busy: boolean) => void;
}

export function AudioUploadPanel({ onBusyChange }: AudioUploadPanelProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [verTranscricao, setVerTranscricao] = useState(false);
  const [sugerirOpen, setSugerirOpen] = useState(false);

  useEffect(() => {
    onBusyChange?.(loading);
    return () => onBusyChange?.(false);
  }, [loading, onBusyChange]);

  const gerar = async () => {
    setErro("");
    if (!arquivo) return setErro("Escolha um arquivo de áudio ou vídeo.");
    setLoading(true);
    try {
      const data = await transcreverAudioApi(arquivo);
      setTitulo(data.titulo);
      setResumo(data.resumo);
      setTranscricao(data.transcricao);
      setSalvo(data.salvo);
      toast(data.salvo ? "Resumo salvo no Contexto" : "Resumo gerado", {
        description: data.salvo
          ? "Guardado em Reuniões."
          : "Não foi possível salvar no Contexto.",
      });
      if (data.salvo) setSugerirOpen(true);
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const nova = () => {
    setResumo(null);
    setTitulo("");
    setTranscricao("");
    setErro("");
    setVerTranscricao(false);
  };

  const docCompleto = () => `# ${titulo}\n\n${resumo ?? ""}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(docCompleto());
      toast("Copiado");
    } catch {
      toast("Não foi possível copiar");
    }
  };
  const baixar = () => {
    const blob = new Blob([docCompleto()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "resumo"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {resumo !== null ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                {titulo}
              </h3>
              {salvo && (
                <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="size-4" /> Salvo no Contexto ·
                  Reuniões
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={nova}
                variant="outlined"
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                <ArrowPathIcon className="size-4" /> Novo
              </Button>
              <Button
                onClick={copiar}
                variant="outlined"
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                <ClipboardDocumentIcon className="size-4" /> Copiar
              </Button>
              <Button
                onClick={baixar}
                variant="outlined"
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                <ArrowDownTrayIcon className="size-4" /> .md
              </Button>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.reunioes}
                titulo={titulo}
                conteudo={resumo}
                tags={["reunião", "resumo", "áudio"]}
              />
              <EnviarParaGrupoButton
                funcao="audio"
                titulo={titulo}
                conteudo={resumo}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVerTranscricao((v) => !v)}
            className="dark:border-dark-600 dark:text-dark-200 mb-3 flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs-plus text-gray-600"
          >
            <span>Ver transcrição bruta</span>
            <ChevronDownIcon
              className={clsx(
                "size-4 transition-transform",
                verTranscricao && "rotate-180",
              )}
            />
          </button>
          {verTranscricao && (
            <p className="dark:border-dark-600 dark:bg-dark-800 dark:text-dark-200 mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs-plus text-gray-600">
              {transcricao}
            </p>
          )}

          <div className="dark:border-dark-600 border-t border-gray-100 pt-3">
            <MarkdownView>{resumo}</MarkdownView>
          </div>
        </div>
      ) : loading ? (
        <div className="grid place-items-center py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <Spinner className="size-6" />
            <p className="dark:text-dark-200 text-sm text-gray-600">
              Transcrevendo e gerando o resumo…
            </p>
            <p className="dark:text-dark-300 text-xs text-gray-400">
              Áudios longos podem levar alguns minutos.
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            gerar();
          }}
          className="flex flex-col gap-3"
        >
          <p className="dark:border-primary-500/20 dark:bg-primary-500/10 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs-plus text-gray-600 dark:text-dark-200">
            A IA <b>transcreve o áudio</b> (OpenAI Whisper) e gera um{" "}
            <b>resumo</b> (com as conexões Obsidian ao final), salvo no Contexto
            (Reuniões).
          </p>

          <div>
            <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
              Arquivo de áudio ou vídeo{" "}
              <span className="text-gray-400">(até 25 MB)</span>
            </label>
            <label className="dark:border-dark-500 dark:hover:border-dark-400 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-8 py-8 text-center hover:border-gray-400">
              <MicrophoneIcon className="size-7 text-gray-400" />
              <span className="dark:text-dark-100 text-sm font-medium text-gray-700">
                {arquivo ? arquivo.name : "Escolher áudio/vídeo"}
              </span>
              <span className="dark:text-dark-300 text-xs text-gray-400">
                MP3, M4A, WAV, MP4, MOV…
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                hidden
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {erro && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
              {erro}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!arquivo}
              className="gap-2"
            >
              <MicrophoneIcon className="size-5" /> Transcrever e resumir
            </Button>
          </div>
        </form>
      )}

      <SugerirPosUploadModal
        isOpen={sugerirOpen}
        close={() => setSugerirOpen(false)}
        titulo={titulo}
        conteudo={resumo ?? undefined}
      />
    </>
  );
}
