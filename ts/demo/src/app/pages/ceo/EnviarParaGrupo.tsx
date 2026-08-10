// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  CheckCircleIcon,
  FolderIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Button, Input, Spinner } from "@/components/ui";
import { getCurrentProduct, products } from "@/app/navigation/ceoOs";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useDocumentsContext } from "@/app/contexts/documents/context";
import type { DocumentAttachment } from "@/app/contexts/documents/context";
import type { AnexoMemoria } from "@/utils/memoriaVault";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import { blobToDataUrl } from "@/utils/idbKv";
import { aiFunctionLabel } from "./ia-functions";
import {
  avisarFalhaMemoria,
  criarPastaDoGrupo,
  salvarDocumentoNoGrupo,
} from "./memoria-grupos";

// ----------------------------------------------------------------------
// Botão "Enviar para o grupo" — irmão do "Salvar na memória", presente em todo
// resultado do AI Studio. Abre um seletor de grupo (agrupamento) e grava o
// conteúdo como documento daquele grupo, que passa a aparecer na aba
// "Documentos" do painel lateral direito da tela do grupo.
//
// Aceita a mesma dupla de props do SalvarNaMemoriaButton (`conteudo` pronto ou
// `preparar` assíncrono), então cada modal descreve o resultado uma vez só e os
// dois destinos — Memória e Grupo — reaproveitam a mesma descrição.
// ----------------------------------------------------------------------

/** Teto por anexo. Acima disso o documento é salvo sem o arquivo (o texto vai). */
const MAX_ANEXO_BYTES = 25 * 1024 * 1024;

interface Props {
  /** Id da ação do AI Studio (ver ia-functions.ts) — vira o rótulo de origem. */
  funcao: string;
  titulo: string;
  /** Conteúdo pronto em Markdown. Ignorado quando `preparar` é passado. */
  conteudo?: string;
  /**
   * Monta o conteúdo na hora do clique — para ações cujo resultado precisa ser
   * construído (HTML do carrossel) ou baixado (imagem, MP4) antes de gravar.
   */
  preparar?: () => Promise<{ conteudo: string; anexos?: AnexoMemoria[] }>;
  /**
   * Assinatura do resultado, para ações em que o conteúdo não chega por prop
   * (`preparar`): quando muda, o botão volta a "Enviar para o grupo".
   */
  versao?: string | number;
  disabled?: boolean;
  className?: string;
}

export function EnviarParaGrupoButton({
  funcao,
  titulo,
  conteudo,
  preparar,
  versao,
  disabled,
  className,
}: Props) {
  const { projects, addProject } = useProjectsContext();
  const { addDocument } = useDocumentsContext();

  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState("");
  // Guardamos a assinatura do que foi enviado, não um booleano: um refino ou
  // uma nova geração volta a habilitar o botão em vez de travar no "No grupo".
  const [enviadoEm, setEnviadoEm] = useState<string | null>(null);

  const assinatura = `${funcao}|${titulo}|${conteudo ?? ""}|${versao ?? ""}`;
  const enviado = enviadoEm === assinatura;

  // Os modais vivem acima do RouterProvider (host global), então não há hooks de
  // rota aqui — o produto atual sai da URL no momento do clique.
  const produtoAtual = getCurrentProduct(window.location.pathname);

  const grupos = [...projects].sort((a, b) => {
    const pa = a.product === produtoAtual.code ? 0 : 1;
    const pb = b.product === produtoAtual.code ? 0 : 1;
    return pa - pb || a.title.localeCompare(b.title, "pt-BR");
  });

  const enviar = async (projectId: string, projectTitle: string, product: string) => {
    setEnviando(true);
    try {
      const pronto = preparar ? await preparar() : { conteudo: conteudo ?? "" };
      const { anexos, ignorados } = await converterAnexos(pronto.anexos);

      addDocument({
        product,
        // Prefixo próprio: mantém os documentos do AI Studio fora dos painéis de
        // squad (que filtram por squadId).
        squadId: `ai-studio:${funcao}`,
        squadName: "AI Studio",
        agentReference: aiFunctionLabel(funcao),
        projectId,
        title: titulo.trim() || aiFunctionLabel(funcao),
        content: pronto.conteudo,
        source: "ai-studio",
        functionId: funcao,
        attachments: anexos.length ? anexos : undefined,
      });

      // Documento salvo num grupo também vira .md na pasta desse grupo na
      // Memória (com os arquivos gerados junto).
      if (memoriaVaultSupported()) {
        const r = await salvarDocumentoNoGrupo({
          grupo: projectTitle,
          titulo: titulo.trim() || aiFunctionLabel(funcao),
          conteudo: pronto.conteudo,
          origem: `AI Studio · ${aiFunctionLabel(funcao)}`,
          anexos: pronto.anexos,
        });
        if (!r.ok) avisarFalhaMemoria(r.reason);
      }

      setEnviadoEm(assinatura);
      setAberto(false);
      toast(`Enviado para ${projectTitle}`, {
        description: ignorados.length
          ? `Está na aba Documentos do grupo. Arquivo grande demais para anexar: ${ignorados.join(", ")}.`
          : "Está na aba Documentos do grupo.",
      });
    } catch {
      toast("Não foi possível enviar para o grupo", {
        description: "Tente novamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  const criarEEnviar = async () => {
    const nome = novoGrupo.trim();
    if (!nome || enviando) return;
    const projeto = addProject({
      product: produtoAtual.code,
      title: nome,
      instructions: "",
      connectorCodes: [],
      links: [],
      files: [],
      memoryIds: [],
    });
    setNovoGrupo("");
    // Grupo novo, pasta nova no Repositório — antes de gravar o documento nela.
    if (memoriaVaultSupported()) {
      const r = await criarPastaDoGrupo({ titulo: projeto.title });
      if (!r.ok) avisarFalhaMemoria(r.reason);
    }
    await enviar(projeto.id, projeto.title, projeto.product);
  };

  return (
    <>
      <Button
        onClick={() => setAberto(true)}
        disabled={disabled || enviando || enviado}
        variant="outlined"
        className={clsx("h-8 gap-1.5 px-2.5 text-xs-plus", className)}
      >
        {enviando ? (
          <Spinner className="size-4" />
        ) : enviado ? (
          <CheckCircleIcon className="size-4" />
        ) : (
          <Squares2X2Icon className="size-4" />
        )}
        {enviado ? "No grupo" : "Enviar para o grupo"}
      </Button>

      <Transition show={aberto}>
        <Dialog
          onClose={() => !enviando && setAberto(false)}
          className="relative z-[90]"
        >
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
            <TransitionChild
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <DialogPanel className="dark:bg-dark-700 my-8 flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
                <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                  <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                    <Squares2X2Icon className="size-5" />
                    Enviar para o grupo
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={() => !enviando && setAberto(false)}
                    aria-label="Fechar"
                    className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <XMarkIcon className="size-5" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                  <p className="dark:text-dark-300 mb-3 text-xs text-gray-500">
                    O conteúdo fica na aba <strong>Documentos</strong> do grupo
                    escolhido.
                  </p>

                  {grupos.length === 0 ? (
                    <p className="dark:text-dark-300 dark:border-dark-600 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-gray-400">
                      Nenhum grupo criado ainda. Dê um nome abaixo para criar o
                      primeiro.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {grupos.map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() => enviar(g.id, g.title, g.product)}
                            className="dark:hover:bg-dark-600 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start hover:bg-gray-100 disabled:opacity-50"
                          >
                            <FolderIcon className="text-primary-500 size-4.5 shrink-0 stroke-[1.75]" />
                            <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-700">
                              {g.title}
                            </span>
                            {g.product !== produtoAtual.code && (
                              <span className="dark:bg-dark-500 dark:text-dark-200 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-tiny-plus text-gray-500">
                                {nomeProduto(g.product)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="dark:border-dark-600 flex shrink-0 items-center gap-2 border-t border-gray-200 px-5 py-3.5">
                  <Input
                    value={novoGrupo}
                    onChange={(e) => setNovoGrupo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void criarEEnviar();
                      }
                    }}
                    placeholder={`Novo grupo em ${produtoAtual.name}...`}
                    classNames={{ root: "flex-1", input: "h-9 text-xs" }}
                  />
                  <Button
                    color="primary"
                    onClick={() => void criarEEnviar()}
                    disabled={!novoGrupo.trim() || enviando}
                    className="h-9 shrink-0 gap-1.5 px-3 text-xs-plus"
                  >
                    {enviando ? (
                      <Spinner className="size-4" />
                    ) : (
                      <PlusIcon className="size-4" />
                    )}
                    Criar e enviar
                  </Button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

// ----------------------------------------------------------------------

function nomeProduto(code: string): string {
  return products.find((p) => p.code === code)?.name ?? code;
}

/**
 * Converte os anexos (Blob) em data-URIs persistíveis. Arquivos acima do teto
 * ficam de fora — o documento ainda é salvo com o texto, e o nome do arquivo
 * ignorado volta para avisar o usuário.
 */
async function converterAnexos(
  anexos: AnexoMemoria[] | undefined,
): Promise<{ anexos: DocumentAttachment[]; ignorados: string[] }> {
  if (!anexos?.length) return { anexos: [], ignorados: [] };

  const convertidos: DocumentAttachment[] = [];
  const ignorados: string[] = [];

  for (const a of anexos) {
    if (a.dados.size > MAX_ANEXO_BYTES) {
      ignorados.push(a.nome);
      continue;
    }
    convertidos.push({
      name: a.nome,
      mime: a.dados.type || mimeFromName(a.nome),
      dataUrl: await blobToDataUrl(a.dados),
    });
  }

  return { anexos: convertidos, ignorados };
}

const MIME_POR_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  html: "text/html",
  md: "text/markdown",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function mimeFromName(nome: string): string {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  return MIME_POR_EXT[ext] ?? "application/octet-stream";
}
