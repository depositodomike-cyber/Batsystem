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
  XMarkIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import { Button, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { MarkdownView } from "./MarkdownView";
import {
  lerNotaMemoria,
  salvarNotaMemoria,
  type VaultFalha,
} from "@/utils/memoriaVault";
import { syncVaultBatch } from "@/services/api/vault";

// ----------------------------------------------------------------------
// Nota do Repositório aberta a partir de um nó do grafo. Lê o .md direto da Pasta
// do Repositório (File System Access API), deixa editar e regrava o arquivo. Ao
// salvar, a nota também é reenviada ao backend para a IA ver a versão nova.
// ----------------------------------------------------------------------

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Caminho relativo à Pasta do Repositório — é o id do nó no grafo. */
  path: string | null;
  /** Título do nó (frontmatter ou nome do arquivo), usado no cabeçalho. */
  titulo?: string;
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

  const pronto = !!path && salvo?.path === path;
  const erro = falha?.path === path ? falha.msg : "";
  const carregando = isOpen && !!path && !pronto && !erro;
  const alterado = pronto && conteudo !== salvo!.texto;

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
                    <div className="dark:bg-dark-800 mb-3 flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
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

                    {modo === "editar" ? (
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

              <div className="dark:border-dark-600 flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
                <Button variant="outlined" onClick={fechar} disabled={salvando}>
                  Fechar
                </Button>
                <Button
                  color="primary"
                  onClick={salvar}
                  disabled={!alterado || salvando || carregando || !!erro}
                  className="gap-1.5"
                >
                  {salvando && <Spinner className="size-4" />}
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
