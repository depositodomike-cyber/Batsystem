// Import Dependencies
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowDownTrayIcon,
  XMarkIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Badge, Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { MarkdownView } from "./MarkdownView";
import {
  caminhoIrmao,
  existeAnexoMemoria,
  lerAnexoMemoria,
  lerNotaMemoria,
  memoriaVaultSupported,
  nomeDoOriginalNaNota,
  salvarNotaMemoria,
  type VaultFalha,
} from "@/utils/memoriaVault";
import { syncVaultBatch } from "@/services/api/vault";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------
// Nota do Repositório aberta a partir de um nó do grafo. Lê o .md direto da Pasta
// do Repositório (File System Access API), deixa editar e regrava o arquivo. Ao
// salvar, a nota também é reenviada ao backend para a IA ver a versão nova.
// ----------------------------------------------------------------------

/**
 * Edição desligada temporariamente: o modal fica só com a nota renderizada.
 * A máquina de edição (estado, `salvar`, ⌘S, aviso de não salvo) continua
 * inteira no arquivo — voltar é trocar a flag para `false`.
 */
const SEM_EDICAO = isFeatureTemporarilyDisabled("memoryNoteEditing");

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Caminho relativo à Pasta do Repositório — é o id do nó no grafo. */
  path: string | null;
  /** Título do nó (frontmatter ou nome do arquivo), usado no cabeçalho. */
  titulo?: string;
  /**
   * Tags de que este conteúdo faz parte, em badges acima do corpo da nota.
   * Vêm de fora porque a fonte é a camada de ENTIDADES do grafo (`extrairTags`,
   * que precisa do vault inteiro para medir recorrência) — não do frontmatter
   * do arquivo, que na prática só traz o tipo ("documento").
   *
   * Opcional: a lista do Repositório não passa. O botão de exportar o arquivo
   * original NÃO depende disto — resolve tudo a partir de `path` e do
   * frontmatter da própria nota.
   */
  tags?: string[];
  /** Avisa a tela do grafo que o arquivo mudou (para atualizar o rótulo do nó). */
  onSalvo?: (conteudo: string) => void;
}

const MOTIVO: Record<VaultFalha, string> = {
  "no-folder":
    "Nenhuma pasta do Repositório selecionada. Use “Sincronizar” para escolher a pasta.",
  denied: "Permissão negada para acessar a pasta do Repositório.",
  unsupported:
    "Este navegador abre o Repositório como cópia somente leitura. Para editar, ative o acesso a pastas (no Brave: brave://flags/#file-system-access-api) ou use o Chrome.",
  "not-found":
    "Arquivo não encontrado na pasta. Sincronize o Repositório e tente de novo.",
  error: "Não foi possível gravar o arquivo.",
};

// Falhas ao LER o arquivo original — o MOTIVO acima é redigido para gravação.
const MOTIVO_ORIGINAL: Record<VaultFalha, string> = {
  "no-folder":
    "Escolha a pasta do Repositório (em “Sincronizar”) para exportar o arquivo original.",
  denied:
    "Permissão negada para ler a pasta do Repositório. Autorize o acesso e tente de novo.",
  unsupported:
    "Este navegador abre o Repositório como cópia somente leitura, sem os arquivos anexos. Use o Chrome.",
  "not-found":
    "O arquivo original não está mais na pasta — ele pode ter sido movido ou renomeado.",
  error: "Não foi possível ler o arquivo original.",
};

const SEM_ORIGINAL =
  "Sem arquivo original guardado — este conteúdo não veio de um upload.";

// Título do frontmatter (mesma leitura do grafo) para atualizar o rótulo do nó.
function tituloDoMd(texto: string, fallback: string): string {
  const fm = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const m =
    fm &&
    (fm[1].match(/^\s*t[íi]tulo\s*:\s*(.+)$/im) ||
      fm[1].match(/^\s*title\s*:\s*(.+)$/im));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : fallback;
}

export function NotaMemoriaModal({
  isOpen,
  close,
  path,
  titulo,
  tags,
  onSalvo,
}: Props) {
  // `salvo` guarda o conteúdo em disco do arquivo aberto; comparado com o do
  // editor, dá o "não salvo". Ambos carregam o path para que o estado da nota
  // anterior nunca vaze para a próxima (o modal é reaproveitado).
  const [salvo, setSalvo] = useState<{ path: string; texto: string } | null>(
    null,
  );
  const [falha, setFalha] = useState<{ path: string; msg: string } | null>(
    null,
  );
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modo, setModo] = useState<"editar" | "ler">("editar");

  // Derivado, e não um `useState("ler")`: os pontos que inicializam `modo`
  // ficam intactos, então religar a flag devolve o comportamento de antes.
  const modoEfetivo = SEM_EDICAO ? "ler" : modo;
  const listaTags = tags ?? [];

  const pronto = !!path && salvo?.path === path;
  const erro = falha?.path === path ? falha.msg : "";
  const carregando = isOpen && !!path && !pronto && !erro;
  const alterado = pronto && conteudo !== salvo!.texto;

  // Exportar o arquivo original ------------------------------------------
  // O ponteiro vem do texto EM DISCO (`salvo`), nunca do buffer do editor: se a
  // edição voltar a ser possível, uma alteração não salva que apague o
  // frontmatter não pode mudar o que se exporta.
  const nomeOriginal = pronto ? nomeDoOriginalNaNota(salvo!.texto) : null;
  const caminhoOriginal =
    path && nomeOriginal ? caminhoIrmao(path, nomeOriginal) : null;

  const semSuporte = !memoriaVaultSupported();
  // Guarda o CAMINHO que se confirmou ausente, não um booleano — mesma proteção
  // que `salvo`/`falha` usam: o modal é reaproveitado entre nós, e assim o
  // resultado da nota anterior nunca vale para a próxima.
  // Só "ausente" desabilita; "indeterminado" (sem pasta/permissão) não, porque o
  // clique é o gesto que pode pedir a permissão que falta.
  const [ausente, setAusente] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const anexoAusente = !!caminhoOriginal && ausente === caminhoOriginal;

  useEffect(() => {
    if (!isOpen || !caminhoOriginal || semSuporte) return;
    let vivo = true;
    existeAnexoMemoria(caminhoOriginal).then((r) => {
      if (vivo && r === "ausente") setAusente(caminhoOriginal);
    });
    return () => {
      vivo = false;
    };
  }, [isOpen, caminhoOriginal, semSuporte]);

  const motivoBloqueio = !nomeOriginal
    ? SEM_ORIGINAL
    : semSuporte
      ? MOTIVO_ORIGINAL.unsupported
      : anexoAusente
        ? MOTIVO_ORIGINAL["not-found"]
        : "";
  const podeExportar = !motivoBloqueio;
  // Enquanto lê (ou se falhou), não há nota da qual exportar: mesma condição do
  // corpo, que nesses estados mostra o spinner/erro em vez do conteúdo.
  const mostrarExportar = !carregando && !erro;

  const exportarOriginal = async () => {
    if (!caminhoOriginal || !nomeOriginal) return;
    setBaixando(true);
    try {
      const r = await lerAnexoMemoria(caminhoOriginal);
      if (!r.ok) {
        if (r.reason === "not-found") setAusente(caminhoOriginal);
        toast("Não foi possível exportar", {
          description: MOTIVO_ORIGINAL[r.reason],
        });
        return;
      }
      const url = URL.createObjectURL(r.arquivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeOriginal;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  };

  // Carrega o arquivo toda vez que um nó é aberto.
  useEffect(() => {
    if (!isOpen || !path) return;
    let vivo = true;
    lerNotaMemoria(path).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setSalvo({ path, texto: r.conteudo });
        setConteudo(r.conteudo);
      } else {
        setFalha({ path, msg: MOTIVO[r.reason] });
      }
    });
    return () => {
      vivo = false;
    };
  }, [isOpen, path]);

  const reset = () => {
    setSalvo(null);
    setFalha(null);
    setConteudo("");
    setModo("editar");
    setAusente(null);
  };

  const fechar = useCallback(() => {
    if (salvando) return;
    if (alterado && !window.confirm("Descartar as alterações não salvas?"))
      return;
    close();
  }, [alterado, close, salvando]);

  const salvar = useCallback(async () => {
    if (!path || salvando) return;
    setSalvando(true);
    const r = await salvarNotaMemoria(path, conteudo);
    if (!r.ok) {
      setSalvando(false);
      toast.error("Não foi possível salvar", { description: MOTIVO[r.reason] });
      return;
    }
    setSalvo({ path, texto: conteudo });
    const nome = path.split("/").pop()!.replace(/\.md$/i, "");
    // Reenvia só esta nota ao backend — a IA passa a responder pela versão nova.
    try {
      await syncVaultBatch([
        { path, titulo: tituloDoMd(conteudo, nome), conteudo },
      ]);
      toast.success("Nota salva", {
        description: `${path} · atualizada também para a IA.`,
      });
    } catch {
      toast.success("Nota salva", {
        description: "O arquivo foi gravado, mas não chegou ao servidor da IA.",
      });
    }
    setSalvando(false);
    onSalvo?.(conteudo);
  }, [conteudo, onSalvo, path, salvando]);

  // ⌘S / Ctrl+S salva sem tirar a mão do teclado.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (alterado) void salvar();
    }
  };

  return (
    <Transition show={isOpen} afterLeave={reset}>
      <Dialog onClose={fechar} className="relative z-[80]">
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

        {/* Sem scroller externo: quem rola é o corpo da nota (h-[55vh] abaixo),
            senão os dois competem e o rodapé fica inalcançável no celular. */}
        <div className="fixed inset-0 flex items-start justify-center sm:p-6">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <DialogPanel
              onKeyDown={onKeyDown}
              // Celular: folha de tela cheia; `sm:` reintroduz o card.
              className="dark:bg-dark-700 flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-xl"
            >
              <div className="dark:border-dark-600 flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
                <div className="min-w-0">
                  <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                    <DocumentTextIcon className="text-primary-500 size-5 shrink-0" />
                    <span className="truncate">{titulo || path || "Nota"}</span>
                  </DialogTitle>
                  {path && (
                    <p className="dark:text-dark-300 text-tiny mt-0.5 truncate font-mono text-gray-500">
                      {path}
                      {alterado && (
                        <span className="text-amber-500"> · não salvo</span>
                      )}
                    </p>
                  )}
                </div>
                <Button
                  onClick={fechar}
                  disabled={salvando}
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              <div className="flex min-h-[50vh] flex-col px-5 py-4">
                {carregando && (
                  <div className="grid grow place-items-center">
                    <div className="dark:text-dark-200 flex items-center gap-3 text-sm text-gray-600">
                      <Spinner className="size-5" />
                      Lendo o arquivo…
                    </div>
                  </div>
                )}

                {!carregando && erro && (
                  <div className="grid grow place-items-center">
                    <p className="text-xs-plus max-w-sm rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                      {erro}
                    </p>
                  </div>
                )}

                {!carregando && !erro && (
                  <>
                    {/* Faixa acima do corpo: com a edição desligada ela mostra
                        as tags do conteúdo; quando a edição voltar, o seletor
                        "Editar / Ler" reaparece no começo da mesma linha. */}
                    {(!SEM_EDICAO || listaTags.length > 0) && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {!SEM_EDICAO && (
                          <div className="dark:bg-dark-800 flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
                            {(["editar", "ler"] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setModo(m)}
                                className={clsx(
                                  "text-xs-plus flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                                  modo === m
                                    ? "dark:bg-dark-600 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                                    : "dark:text-dark-300 text-gray-500",
                                )}
                              >
                                {m === "editar" ? (
                                  <PencilSquareIcon className="size-4" />
                                ) : (
                                  <EyeIcon className="size-4" />
                                )}
                                {m === "editar" ? "Editar" : "Ler"}
                              </button>
                            ))}
                          </div>
                        )}

                        {listaTags.map((t) => (
                          <Badge
                            key={t}
                            variant="soft"
                            color="neutral"
                            className="text-tiny"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {modoEfetivo === "editar" ? (
                      <MemoriaTextarea
                        autoFocus
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        spellCheck={false}
                        className="dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 focus:border-primary-500 text-xs-plus h-[55vh] w-full resize-none rounded-lg border border-gray-200 bg-white p-3 font-mono leading-relaxed text-gray-800 outline-hidden"
                      />
                    ) : (
                      <div className="dark:border-dark-600 dark:bg-dark-800 h-[55vh] overflow-y-auto rounded-lg border border-gray-200 bg-white px-4 py-2">
                        <MarkdownView>{conteudo}</MarkdownView>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="dark:border-dark-600 flex shrink-0 items-center gap-3 border-t border-gray-200 px-5 py-3">
                {/* Motivo do bloqueio à esquerda, na mesma linha do rodapé:
                    tooltip em botão desabilitado não abre em vários navegadores
                    nem existe no touch. */}
                {mostrarExportar && !podeExportar && (
                  <span className="dark:text-dark-300 text-tiny min-w-0 flex-1 text-gray-400">
                    {motivoBloqueio}
                  </span>
                )}
                {/* Exportar o arquivo-fonte do upload (não o resumo da IA).
                    Fica no rodapé, à esquerda de "Fechar" — `ml-auto` mantém o
                    grupo à direita mesmo quando o motivo acima não renderiza. */}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {mostrarExportar && (
                    <Button
                      onClick={exportarOriginal}
                      disabled={!podeExportar || baixando}
                      aria-disabled={!podeExportar || baixando}
                      variant="outlined"
                      className="gap-1.5"
                      title={
                        podeExportar
                          ? `Exportar ${nomeOriginal}`
                          : motivoBloqueio
                      }
                    >
                      {baixando ? (
                        <Spinner className="size-4" />
                      ) : (
                        <ArrowDownTrayIcon className="size-4" />
                      )}
                      Exportar arquivo original
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={fechar}
                    disabled={salvando}
                  >
                    Fechar
                  </Button>
                  {!SEM_EDICAO && (
                    <Button
                      color="primary"
                      onClick={salvar}
                      disabled={!alterado || salvando || carregando || !!erro}
                      className="gap-1.5"
                    >
                      {salvando && <Spinner className="size-4" />}
                      {salvando ? "Salvando…" : "Salvar"}
                    </Button>
                  )}
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
