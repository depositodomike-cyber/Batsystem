// Import Dependencies
import { Link, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useDocumentoUpload } from "@/app/contexts/documento-upload/context";
import { lerOriginalGuardado } from "@/app/contexts/documento-upload/original";
import { useMemoryContext } from "@/app/contexts/memory/context";
import { useIaModals } from "@/app/contexts/ia-modals/context";
import { MarkdownView } from "./MarkdownView";
import { SugerirPosUploadModal } from "./SugerirPosUpload";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Página do documento — destino permanente do upload. Enquanto a IA analisa,
// mostra "Arquivo recebido" + "Analisando conteúdo". Depois, as mesmas
// informações e ações que antes viviam no DocumentoModal.
// ----------------------------------------------------------------------

export default function Documento() {
  const { pathname } = useLocation();
  const { documentoId } = useParams();
  const product = getCurrentProduct(pathname);
  const { obter, consumirSugerir } = useDocumentoUpload();
  const { memories, loading: memoriesLoading } = useMemoryContext();
  const { open: openIaModal } = useIaModals();

  const upload = documentoId ? obter(documentoId) : undefined;
  const memoria =
    !upload && documentoId
      ? memories.find((m) => m.id === documentoId)
      : undefined;

  // Dados unificados: prioriza o store da sessão; senão, a Memória da API.
  const titulo = upload?.titulo ?? memoria?.title ?? "";
  const conteudo = upload?.conteudo ?? memoria?.content ?? null;
  const salvo = upload?.salvo ?? !!memoria;
  const processando = upload?.estado === "analisando";
  const comErro = upload?.estado === "erro";
  const pronto = !!conteudo && !processando && !comErro;

  // O SugerirPosUpload abre sozinho quando o upload conclui com salvo: o estado
  // vem direto do store (sugerirPendente). Fechar consome a flag — sem efeito
  // nem setState duplicado. Deep links (sem upload no store) nunca disparam.
  const sugerirOpen = !!upload?.sugerirPendente;
  const fecharSugerir = () => {
    if (documentoId) consumirSugerir(documentoId);
  };

  const abrirNovoUpload = () => openIaModal("upload", { aba: "documento" });

  // Grava a nota junto com o arquivo que a originou, para o modal da nota poder
  // exportar o arquivo-fonte depois. Os bytes vêm do store da sessão e, se a
  // aba foi recarregada, da cópia no IndexedDB. Upload de texto colado não tem
  // original — e aí a nota é salva sem ele, como antes.
  const prepararMemoria = async () => {
    const nome = upload?.nomeArquivo;
    const dados = upload?.arquivoOriginal;
    if (!dados && documentoId) {
      const guardado = await lerOriginalGuardado(documentoId);
      if (guardado) return { conteudo: conteudo ?? "", original: guardado };
    }
    return {
      conteudo: conteudo ?? "",
      original: dados && nome ? { nome, dados } : undefined,
    };
  };

  const docCompleto = () => `# ${titulo}\n\n${conteudo ?? ""}`;
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
    a.download = `${titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "documento"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Documento inexistente: nem no store nem na Memória (após carregar).
  const naoEncontrado =
    !processando &&
    !comErro &&
    !pronto &&
    !memoriesLoading &&
    !!documentoId &&
    !upload &&
    !memoria;

  return (
    <Page title={`${titulo || "Documento"} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex flex-col gap-1">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      Documento organizado pela IA a partir de um upload. O
                      conteúdo fica salvo no <strong>Repositório · Documentos</strong>{" "}
                      e pode ser enviado para um agrupamento ou gravado como{" "}
                      <span className="font-mono">.md</span> na pasta local.
                    </p>
                  </>
                ),
              }}
            >
              {processando ? "Documento" : titulo || "Documento"}
            </PageTitle>
            {upload?.nomeArquivo && processando && (
              <p className="dark:text-dark-300 text-sm text-gray-500">
                {upload.nomeArquivo}
              </p>
            )}
          </div>

          {/* ESTADO 1 — Processando */}
          {processando && (
            <div className="grid place-items-center py-16">
              <div className="flex flex-col items-start gap-3">
                <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="size-5" />
                  Arquivo recebido
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-200">
                  <Spinner className="size-5" />
                  Analisando conteúdo
                </div>
              </div>
            </div>
          )}

          {/* ESTADO 3 — Erro */}
          {comErro && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {upload?.erro ?? "Falha ao organizar o documento. Tente novamente."}
              </div>
              <Button
                onClick={abrirNovoUpload}
                color="primary"
                className="gap-2"
              >
                <ArrowUpTrayIcon className="size-5" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Documento não encontrado */}
          {naoEncontrado && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <DocumentTextIcon className="dark:text-dark-300 size-10 text-gray-400" />
              <p className="dark:text-dark-200 text-sm text-gray-600">
                Documento não encontrado. Ele pode ter sido removido ou o
                processamento foi interrompido.
              </p>
              <div className="flex gap-2">
                <Button
                  component={Link}
                  to={`/${product.code}/configuracoes?secao=regras`}
                  variant="outlined"
                >
                  Ir para Regras
                </Button>
                <Button
                  onClick={abrirNovoUpload}
                  color="primary"
                  className="gap-2"
                >
                  <ArrowUpTrayIcon className="size-5" />
                  Novo upload
                </Button>
              </div>
            </div>
          )}

          {/* Carregando memórias (deep link) */}
          {!processando && !comErro && !pronto && memoriesLoading && (
            <div className="grid place-items-center py-16">
              <Spinner className="size-6" />
            </div>
          )}

          {/* ESTADO 2 — Processado */}
          {pronto && conteudo !== null && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                    {titulo}
                  </h3>
                  {salvo && (
                    <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircleIcon className="size-4" /> Salvo na Memória ·
                      Documentos
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={abrirNovoUpload}
                    variant="outlined"
                    className="h-8 gap-1.5 px-2.5 text-xs-plus"
                  >
                    <ArrowPathIcon className="size-4" /> Novo upload
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
                    pasta={PASTA_MEMORIA.documento}
                    titulo={titulo}
                    conteudo={conteudo}
                    preparar={prepararMemoria}
                    tags={["documento"]}
                  />
                  <EnviarParaGrupoButton
                    funcao="documento"
                    titulo={titulo}
                    conteudo={conteudo}
                    preparar={prepararMemoria}
                  />
                </div>
              </div>
              <div className="dark:border-dark-600 border-t border-gray-100 pt-3">
                <MarkdownView>{conteudo}</MarkdownView>
              </div>
            </div>
          )}
        </div>
      </div>

      <SugerirPosUploadModal
        isOpen={sugerirOpen}
        close={fecharSugerir}
        titulo={titulo}
        conteudo={conteudo ?? undefined}
      />
    </Page>
  );
}
