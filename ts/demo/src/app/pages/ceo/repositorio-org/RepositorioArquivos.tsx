// Import Dependencies
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import {
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Badge, Button, Spinner } from "@/components/ui";
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import { formatDate } from "@/utils/arquivos";
import {
  useDocumentosOrg,
  usePodeGerenciarRepositorio,
  type LinhaDocumentoOrg,
} from "./useDocumentosOrg";

// ----------------------------------------------------------------------
// Repositório → Visualizar arquivos
//
// Listagem PRÓPRIA dos documentos da organização. Visualmente é a lista do
// Repositório pessoal (mesma linha de `LinhaNota` e mesma busca de
// MemoriaLista, empty state tracejado de Documentos); os DADOS são outros — vêm de
// /repositorio-org/documentos e nunca aparecem na lista pessoal nem no grafo.
//
// A busca daqui filtra só esta tabela. A busca da IA é outra coisa: o
// /ai/prompt consulta estes documentos no servidor, por relevância.

/** Mesmo `accept` do upload de documento (DocumentoUploadPanel). */
const ACCEPT = ".txt,.md,.markdown,.pdf,.docx,.csv,.json,.log";

export function RepositorioArquivos({ onVoltar }: { onVoltar: () => void }) {
  const { documentos, carregando, erro, enviar, remover } = useDocumentosOrg();
  const podeGerenciar = usePodeGerenciarRepositorio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(false);

  const [removendo, setRemovendo] = useState<LinhaDocumentoOrg | null>(null);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");
  const [confirmando, setConfirmando] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        d.tipo.toLowerCase().includes(q) ||
        d.adicionadoPorNome.toLowerCase().includes(q),
    );
  }, [documentos, busca]);

  const abrirUpload = () => inputRef.current?.click();

  const enviarArquivos = (arquivos: FileList | File[]) => {
    for (const arquivo of Array.from(arquivos)) {
      void enviar(arquivo).then((linha) => {
        if (!linha) return;
        if (linha.status === "disponivel") {
          toast.success(`“${linha.nome}” adicionado ao repositório.`);
        } else {
          toast.error(`Não foi possível processar “${linha.nome}”.`, {
            description: linha.erro ?? undefined,
          });
        }
      });
    }
  };

  const aoSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (!podeGerenciar) return;
    if (e.dataTransfer.files.length) enviarArquivos(e.dataTransfer.files);
  };

  const pedirRemocao = (doc: LinhaDocumentoOrg) => {
    setEstadoConfirm("pending");
    setRemovendo(doc);
  };

  const confirmarRemocao = async () => {
    if (!removendo) return;
    setConfirmando(true);
    try {
      await remover(removendo.id);
      setEstadoConfirm("success");
    } catch {
      setEstadoConfirm("error");
    } finally {
      setConfirmando(false);
    }
  };

  const buscando = busca.trim().length > 0;

  return (
    <div
      className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
      onDragOver={(e) => {
        if (!podeGerenciar) return;
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
    >
      <button
        type="button"
        onClick={onVoltar}
        className="dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500"
      >
        <ArrowLeftIcon className="size-3.5" />
        Voltar
      </button>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
            Repositório
          </h3>
          <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
            Documentos compartilhados que fazem parte da base de conhecimento
            da organização.
          </p>
        </div>
        {podeGerenciar && (
          <Button
            color="primary"
            onClick={abrirUpload}
            className="h-10 shrink-0 gap-1.5 rounded-lg"
          >
            <ArrowUpTrayIcon className="size-4.5" />
            Upload
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) enviarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />

      {/* Busca — filtra só esta tabela */}
      {documentos.length > 0 && (
        <div className="relative w-full lg:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar arquivos…"
            className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white pr-9 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="dark:hover:text-dark-100 absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </div>
      )}

      {carregando ? (
        <div className="dark:text-dark-200 flex items-center justify-center gap-3 py-16 text-sm text-gray-600">
          <Spinner className="size-5" />
          Carregando o repositório…
        </div>
      ) : erro && documentos.length === 0 ? (
        <p className="text-xs-plus text-warning py-6 text-center">{erro}</p>
      ) : filtrados.length === 0 ? (
        <EstadoVazio
          buscando={buscando}
          arrastando={arrastando}
          podeGerenciar={podeGerenciar}
          onUpload={abrirUpload}
        />
      ) : (
        <ListaDocumentos
          itens={filtrados}
          arrastando={arrastando}
          podeGerenciar={podeGerenciar}
          onRemover={pedirRemocao}
        />
      )}

      <ConfirmModal
        show={removendo !== null}
        onClose={() => setRemovendo(null)}
        onOk={() => void confirmarRemocao()}
        confirmLoading={confirmando}
        state={estadoConfirm}
        messages={{
          pending: {
            title: "Remover este documento?",
            description: `“${removendo?.nome ?? ""}” sai do repositório da organização e deixa de ser usado como contexto pela IA.`,
            actionText: "Remover",
          },
          success: {
            title: "Documento removido",
            description: "Ele não aparece mais no repositório.",
            actionText: "Ok",
          },
          error: {
            title: "Não foi possível remover",
            description: "Tente novamente em instantes.",
            actionText: "Tentar de novo",
          },
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------

/**
 * Lista no MESMO visual da lista do Repositório pessoal (`LinhaNota`, em
 * MemoriaLista.tsx): ícone em tile, título + badge de tipo, linha secundária
 * em mono, chip à direita e data. Só os dados mudam — aqui o chip é o status
 * de processamento e a linha secundária diz quem adicionou.
 */
function ListaDocumentos({
  itens,
  arrastando,
  podeGerenciar,
  onRemover,
}: {
  itens: LinhaDocumentoOrg[];
  arrastando: boolean;
  podeGerenciar: boolean;
  onRemover: (doc: LinhaDocumentoOrg) => void;
}) {
  return (
    <div
      className={clsx(
        "dark:border-dark-600 mt-4 overflow-hidden rounded-xl border border-gray-200",
        arrastando && "border-primary-500 dark:border-primary-500",
      )}
    >
      <ul className="dark:divide-dark-600 dark:bg-dark-700 divide-y divide-gray-100 bg-white">
        {itens.map((d) => (
          <LinhaDocumento
            key={d.id}
            doc={d}
            podeGerenciar={podeGerenciar}
            onRemover={() => onRemover(d)}
          />
        ))}
      </ul>
    </div>
  );
}

function LinhaDocumento({
  doc,
  podeGerenciar,
  onRemover,
}: {
  doc: LinhaDocumentoOrg;
  podeGerenciar: boolean;
  onRemover: () => void;
}) {
  const titulo = doc.nome.replace(/\.[^.]+$/, "") || doc.nome;

  return (
    <li className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
      <span className="dark:bg-dark-600 dark:text-dark-200 grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
        <DocumentTextIcon className="size-5 stroke-[1.5]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className="dark:text-dark-100 truncate text-sm font-medium text-gray-800"
            title={titulo}
          >
            {titulo}
          </span>
          <Badge variant="soft" color="neutral" className="text-tiny shrink-0">
            {doc.tipo.toUpperCase()}
          </Badge>
        </span>
        <span
          className="dark:text-dark-300 text-tiny mt-0.5 block truncate font-mono text-gray-400"
          title={doc.nome}
        >
          {doc.nome}
          <span className="font-sans"> · Adicionado por {doc.adicionadoPorNome}</span>
        </span>
      </span>

      <span className="shrink-0">
        <StatusDocumento doc={doc} />
      </span>

      <span className="dark:text-dark-300 text-tiny hidden w-24 shrink-0 text-end text-gray-400 sm:block">
        {formatDate(doc.criadoEm)}
      </span>

      {podeGerenciar && (
        <button
          type="button"
          onClick={onRemover}
          disabled={doc.status === "processando"}
          title="Remover"
          aria-label={`Remover ${doc.nome}`}
          className="dark:text-dark-200 dark:hover:bg-dark-500 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrashIcon className="size-4.5" />
        </button>
      )}
    </li>
  );
}

function StatusDocumento({ doc }: { doc: LinhaDocumentoOrg }) {
  if (doc.status === "processando") {
    return (
      <Badge variant="soft" color="warning" className="text-tiny gap-1.5">
        <Spinner className="size-3 border-2" />
        Processando
      </Badge>
    );
  }
  if (doc.status === "erro") {
    return (
      <Badge
        variant="soft"
        color="error"
        className="text-tiny"
        data-tooltip
        data-tooltip-content={doc.erro ?? "Erro ao processar o arquivo."}
        title={doc.erro ?? undefined}
      >
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="soft" color="success" className="text-tiny">
      Disponível
    </Badge>
  );
}

function EstadoVazio({
  buscando,
  arrastando,
  podeGerenciar,
  onUpload,
}: {
  buscando: boolean;
  arrastando: boolean;
  podeGerenciar: boolean;
  onUpload: () => void;
}) {
  return (
    <div
      className={clsx(
        "dark:border-dark-600 mt-5 grid place-items-center rounded-2xl border-2 border-dashed border-gray-200 px-6 py-16 text-center",
        arrastando && "border-primary-500 dark:border-primary-500",
      )}
    >
      <div className="max-w-sm">
        <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 mx-auto grid size-14 place-items-center rounded-2xl">
          {buscando ? (
            <MagnifyingGlassIcon className="size-7 stroke-[1.5]" />
          ) : (
            <FolderOpenIcon className="size-7 stroke-[1.5]" />
          )}
        </div>
        <h3 className="dark:text-dark-50 mt-3 text-base font-semibold text-gray-800">
          {buscando ? "Nenhum arquivo encontrado" : "Nenhum arquivo no repositório"}
        </h3>
        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
          {buscando
            ? "Ajuste a busca para encontrar o que procura."
            : "Adicione documentos para começar a construir a base de conhecimento compartilhada da organização."}
        </p>
        {!buscando && podeGerenciar && (
          <div className="mt-4 flex justify-center">
            <Button
              color="primary"
              onClick={onUpload}
              className="gap-2 rounded-lg px-4"
            >
              <ArrowUpTrayIcon className="size-4.5" />
              Fazer upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
