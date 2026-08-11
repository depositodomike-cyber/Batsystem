import { useEffect, useRef, useState } from "react";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

import { Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { useDocumentoUpload } from "@/app/contexts/documento-upload/context";
import type { DocumentoUpload } from "@/app/contexts/documento-upload/context";

// ----------------------------------------------------------------------
// Conteúdo da aba "Documento" do UploadModal. O processamento permanece dentro
// do modal; a página de visualização só abre depois que o resultado estiver pronto.
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

export interface DocumentoUploadPanelProps {
  onBusyChange?: (busy: boolean) => void;
  onFinished?: (upload: DocumentoUpload) => void;
  onFailed?: (mensagem: string) => void;
}

function errMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Falha ao organizar o documento. Tente novamente.";
}

export function DocumentoUploadPanel({
  onBusyChange,
  onFinished,
  onFailed,
}: DocumentoUploadPanelProps) {
  const { iniciar } = useDocumentoUpload();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  // O modal pode ser minimizado enquanto a Promise está pendente. A ref garante
  // que o desfecho use os callbacks da renderização mais recente (`isOpen` atual).
  const desfechoRef = useRef({ onFinished, onFailed });

  useEffect(() => {
    desfechoRef.current = { onFinished, onFailed };
  }, [onFinished, onFailed]);

  useEffect(() => {
    onBusyChange?.(loading);
    return () => onBusyChange?.(false);
  }, [loading, onBusyChange]);

  const enviar = async () => {
    setErro("");
    if (!arquivo && !texto.trim()) {
      setErro("Cole o conteúdo ou envie um arquivo.");
      return;
    }
    setLoading(true);
    try {
      const pronto = await iniciar({
        arquivo,
        texto: texto.trim() || undefined,
      });
      setArquivo(null);
      setTexto("");
      setLoading(false);
      desfechoRef.current.onFinished?.(pronto);
    } catch (err) {
      const mensagem = errMessage(err);
      setErro(mensagem);
      setLoading(false);
      desfechoRef.current.onFailed?.(mensagem);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="size-6" />
          <p className="dark:text-dark-200 text-sm text-gray-600">
            Organizando e salvando o documento…
          </p>
          <p className="dark:text-dark-300 text-xs text-gray-400">
            Você pode minimizar esta janela e continuar navegando.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
          Cole o conteúdo do documento
        </label>
        <MemoriaTextarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          placeholder="Cole aqui o texto do documento…"
          className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="dark:text-dark-200 text-xs-plus mb-1 block font-medium text-gray-600">
          — ou — envie um arquivo{" "}
          <span className="text-gray-400">(.txt, .md, .pdf, .docx…)</span>
        </label>
        <div className="flex items-center gap-3">
          <label className="dark:border-dark-500 dark:hover:border-dark-400 text-xs-plus dark:text-dark-200 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-gray-600 hover:border-gray-400">
            <ArrowUpTrayIcon className="size-4" /> Carregar arquivo
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

      {erro && (
        <div className="text-xs-plus rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
          {erro}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          color="primary"
          disabled={!arquivo && !texto.trim()}
          className="gap-2"
        >
          <DocumentTextIcon className="size-5" /> Organizar e salvar
        </Button>
      </div>
    </form>
  );
}
