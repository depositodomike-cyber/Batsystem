// Import Dependencies
import { useState } from "react";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Button } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { IaModalShell } from "@/app/contexts/ia-modals/IaModalShell";
import { useDocumentoUpload } from "@/app/contexts/documento-upload/context";

// ----------------------------------------------------------------------
// Upload Documento — ponto de entrada. O usuário cola texto ou escolhe um
// arquivo; ao enviar, o DocumentoUploadProvider assume a requisição e
// navega para a página do documento, onde o processamento continua.
// ----------------------------------------------------------------------

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function DocumentoModal({ isOpen, close, onMinimize }: Props) {
  const { iniciar } = useDocumentoUpload();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  const fechar = () => {
    close();
  };

  const enviar = () => {
    setErro("");
    if (!arquivo && !texto.trim()) {
      setErro("Cole o conteúdo ou envie um arquivo.");
      return;
    }
    iniciar({ arquivo, texto: texto.trim() || undefined });
    // Limpa o formulário para a próxima abertura e fecha o modal.
    setArquivo(null);
    setTexto("");
    setErro("");
    close();
  };

  return (
    <IaModalShell
      isOpen={isOpen}
      close={fechar}
      onMinimize={onMinimize}
      title="IA · Upload Documento"
      icon={DocumentTextIcon}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex flex-col gap-3"
      >
        <p className="dark:border-primary-500/20 dark:bg-primary-500/10 border-primary-200 bg-primary-50 text-xs-plus dark:text-dark-200 rounded-lg border px-3 py-2 text-gray-600">
          A IA formata o conteúdo num <b>documento de referência</b> bem
          estruturado e o <b>salva no Repositório</b> (Documentos), com{" "}
          <span className="font-mono">[[relacionamentos]]</span> às regras
          existentes.
        </p>

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
    </IaModalShell>
  );
}
