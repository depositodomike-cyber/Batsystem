import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bars2Icon,
  CpuChipIcon,
  PhotoIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import clsx from "clsx";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";

import { Button } from "@/components/ui";
import { DropIndicator } from "@/components/shared/DropIndicator";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { useDisclosure } from "@/hooks";
import {
  createAiCredential,
  getAiProviders,
  listAiCredentials,
  removeAiCredential,
  PROVEDORES_PADRAO,
  type AiCredential,
  type AiModality,
  type CatalogProvider,
} from "@/services/api/aiCredential";
import {
  addAiConnection,
  listAiConnections,
  removeAiConnection,
  reorderAiConnections,
} from "@/services/api/aiConnection";
import {
  addAiMediaConnection,
  listAiMediaConnections,
  removeAiMediaConnection,
  reorderAiMediaConnections,
} from "@/services/api/aiMediaConnection";

// ----------------------------------------------------------------------

interface QueueItem {
  id: string;
  credentialId: string;
  provider: string;
  nome: string | null;
  model: string;
  keyLast4: string;
  status: "ativa" | "invalida";
}

interface ModalityAdapter {
  list(): Promise<QueueItem[]>;
  add(input: { credentialId: string; model: string }): Promise<QueueItem>;
  remove(id: string): Promise<void>;
  reorder(ids: string[]): Promise<QueueItem[]>;
}

interface Modality {
  id: AiModality;
  label: string;
  icon: React.ElementType;
  adapter: ModalityAdapter;
}

const MODALITIES: Modality[] = [
  {
    id: "text",
    label: "Texto",
    icon: CpuChipIcon,
    adapter: {
      list: () => listAiConnections(),
      add: (input) => addAiConnection(input),
      remove: (id) => removeAiConnection(id),
      reorder: (ids) => reorderAiConnections(ids),
    },
  },
  {
    id: "image",
    label: "Imagem",
    icon: PhotoIcon,
    adapter: {
      list: () => listAiMediaConnections("image"),
      add: (input) => addAiMediaConnection("image", input),
      remove: (id) => removeAiMediaConnection("image", id),
      reorder: (ids) => reorderAiMediaConnections("image", ids),
    },
  },
  {
    id: "video",
    label: "Vídeo",
    icon: VideoCameraIcon,
    adapter: {
      list: () => listAiMediaConnections("video"),
      add: (input) => addAiMediaConnection("video", input),
      remove: (id) => removeAiMediaConnection("video", id),
      reorder: (ids) => reorderAiMediaConnections("video", ids),
    },
  },
];

const DRAG_TIPO = "ai-model";

interface DragData {
  tipo: string;
  modalidade: string;
  id: string;
}

function ehDragDaModalidade(
  data: Record<string | symbol, unknown>,
  modalidade: string,
): boolean {
  return data.tipo === DRAG_TIPO && data.modalidade === modalidade;
}

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m) && typeof m[0] === "string") return m[0];
  }
  return "Não foi possível concluir. Tente novamente.";
}

function nomeProvedor(providers: CatalogProvider[], id: string): string {
  return providers.find((p) => p.id === id)?.name ?? id;
}

function nomeModelo(
  providers: CatalogProvider[],
  provider: string,
  modality: AiModality,
  model: string,
): string {
  return (
    providers
      .find((p) => p.id === provider)
      ?.models.find((m) => m.id === model && m.modality === modality)?.name ??
    model
  );
}

function rotuloCredencial(
  providers: CatalogProvider[],
  c: { provider: string; nome: string | null },
): string {
  const provedor = nomeProvedor(providers, c.provider);
  return c.nome ? `${provedor} — ${c.nome}` : provedor;
}

/**
 * Configuração de IA do tenant: primeiro as chaves dos provedores, depois a
 * prioridade dos modelos em cada modalidade. A chave nunca volta do servidor.
 */
export function AiConnectionCard() {
  // Começa no espelho local do catálogo (ver `PROVEDORES_PADRAO`): o select de
  // provedor já nasce preenchido e a resposta do servidor só o substitui.
  const [providers, setProviders] =
    useState<CatalogProvider[]>(PROVEDORES_PADRAO);
  const [creds, setCreds] = useState<AiCredential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // `allSettled`: uma falha ao listar as chaves não pode descartar o
      // catálogo (nem o contrário, como acontecia com o `Promise.all`).
      await Promise.allSettled([
        getAiProviders().then((provs) => {
          if (alive) setProviders(provs);
        }),
        listAiCredentials().then((lista) => {
          if (alive) setCreds(lista);
        }),
      ]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onCredsChange = useCallback((lista: AiCredential[]) => {
    setCreds(lista);
  }, []);

  if (loading) {
    return (
      <p className="dark:text-dark-300 text-sm text-gray-400">Carregando…</p>
    );
  }

  return (
    <div>
      <KeysSection
        providers={providers}
        creds={creds}
        onCredsChange={onCredsChange}
      />

      <div className="dark:divide-dark-500 mt-12 divide-y divide-gray-200">
        <p className="dark:text-dark-200 pb-4 text-sm font-semibold text-gray-800">
          Modelos e Prioridades
        </p>
        {creds.length === 0 && (
          <p className="dark:text-dark-300 mb-4 text-sm text-gray-500">
            Adicione uma chave de API para começar a configurar seus modelos.
          </p>
        )}
        {MODALITIES.map((m) => (
          <section key={m.id} className="py-5 first:pt-0 last:pb-0">
            <ModalityPanel
              modality={m}
              providers={providers}
              creds={creds}
              semChaves={creds.length === 0}
              onModelCount={(credentialId, delta) =>
                setCreds((prev) =>
                  prev.map((c) =>
                    c.id === credentialId
                      ? {
                          ...c,
                          modelCount: Math.max(0, c.modelCount + delta),
                        }
                      : c,
                  ),
                )
              }
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function KeysSection({
  providers,
  creds,
  onCredsChange,
}: {
  providers: CatalogProvider[];
  creds: AiCredential[];
  onCredsChange: (lista: AiCredential[]) => void;
}) {
  const [modalOpen, modal] = useDisclosure(false);
  const [toDelete, setToDelete] = useState<AiCredential | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteState, setDeleteState] = useState<"pending" | "success" | "error">(
    "pending",
  );

  const onCreated = (c: AiCredential) => {
    onCredsChange([...creds, c]);
    modal.close();
  };

  const confirmarRemocao = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await removeAiCredential(toDelete.id);
      onCredsChange(creds.filter((c) => c.id !== toDelete.id));
      setToDelete(null);
      setDeleteState("pending");
    } catch {
      setDeleteState("error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section>
      <h4 className="dark:text-dark-100 text-sm font-semibold text-gray-800">
        Chaves de API
      </h4>
      <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
        Conecte os provedores de IA utilizados pela sua empresa. As chaves são
        armazenadas de forma segura e nunca são exibidas por completo.
      </p>

      {creds.length === 0 ? (
        <div className="dark:border-dark-500 dark:bg-dark-600 mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-5">
          <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
            Nenhuma chave de API conectada
          </p>
          <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
            Adicione uma chave para conectar os provedores de IA da sua empresa.
          </p>
          <Button
            variant="outlined"
            color="primary"
            className="mt-3 gap-1.5"
            onClick={modal.open}
          >
            <PlusIcon className="size-4" />
            Adicionar chave de API
          </Button>
        </div>
      ) : (
        <>
          <ul className="dark:divide-dark-500 dark:border-dark-500 dark:bg-dark-600 mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50">
            {creds.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                    {rotuloCredencial(providers, c)}
                  </p>
                  <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
                    ••••{c.keyLast4}
                    <span className="mx-1.5">·</span>
                    {c.modelCount === 0
                      ? "nenhum modelo conectado"
                      : `${c.modelCount} ${c.modelCount === 1 ? "modelo conectado" : "modelos conectados"}`}
                  </p>
                </div>
                {c.status === "invalida" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    <ExclamationTriangleIcon className="size-3.5" />
                    chave recusada
                  </span>
                )}
                <KeyMenu onRemove={() => {
                  setDeleteState("pending");
                  setToDelete(c);
                }} />
              </li>
            ))}
          </ul>
          <Button
            variant="outlined"
            color="primary"
            className="mt-3 h-8 gap-1.5 text-xs"
            onClick={modal.open}
          >
            <PlusIcon className="size-4" />
            Adicionar chave
          </Button>
        </>
      )}

      <AddKeyModal
        open={modalOpen}
        onClose={modal.close}
        providers={providers}
        onCreated={onCreated}
      />

      <ConfirmModal
        show={!!toDelete}
        onClose={() => {
          if (deleting) return;
          setToDelete(null);
          setDeleteState("pending");
        }}
        onOk={confirmarRemocao}
        confirmLoading={deleting}
        state={deleteState}
        messages={{
          pending: {
            title: "Remover esta chave?",
            description:
              "Os modelos que usam esta conexão sairão das filas de Texto, Imagem e Vídeo.",
            actionText: "Remover",
          },
          success: {
            title: "Chave removida",
            description: "A conexão foi desconectada.",
            actionText: "Ok",
          },
          error: {
            title: "Não foi possível remover",
            description: "Tente novamente em instantes.",
            actionText: "Tentar de novo",
          },
        }}
      />
    </section>
  );
}

function KeyMenu({ onRemove }: { onRemove: () => void }) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label="Ações da chave"
        className="dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <EllipsisVerticalIcon className="size-5" />
      </MenuButton>
      <Transition
        as={MenuItems}
        anchor={{ to: "bottom end", gap: 4 }}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onRemove}
              className={clsx(
                "this:error text-this dark:text-this-light flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors",
                focus && "bg-this/10 dark:bg-this-light/10",
              )}
            >
              <TrashIcon className="size-4" />
              Remover
            </button>
          )}
        </MenuItem>
      </Transition>
    </Menu>
  );
}

function AddKeyModal({
  open,
  onClose,
  providers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  providers: CatalogProvider[];
  onCreated: (c: AiCredential) => void;
}) {
  const [escolhido, setEscolhido] = useState("");
  const [nome, setNome] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset só quando abre. Antes dependia também de `providers`, então a
  // chegada do catálogo no meio do preenchimento apagava a chave já digitada.
  useEffect(() => {
    if (!open) return;
    setEscolhido("");
    setNome("");
    setApiKey("");
    setError(null);
  }, [open]);

  // Derivado, não sincronizado por efeito: a lista do servidor chega depois da
  // primeira renderização, então o valor escolhido só vale enquanto existir no
  // catálogo; fora isso, cai no primeiro provedor da lista.
  const providerId = providers.some((p) => p.id === escolhido)
    ? escolhido
    : (providers[0]?.id ?? "");

  const salvar = async () => {
    setError(null);
    if (!apiKey.trim()) {
      setError("Cole a chave de API do provedor.");
      return;
    }
    setSaving(true);
    try {
      const criado = await createAiCredential({
        provider: providerId,
        apiKey,
        nome: nome.trim() || undefined,
      });
      onCreated(criado);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
        onClose={() => {
          if (!saving) onClose();
        }}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="absolute inset-0 bg-gray-900/50 transition-opacity dark:bg-black/40" />
        </TransitionChild>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogPanel className="scrollbar-sm relative w-full max-w-md overflow-y-auto rounded-lg bg-white px-5 py-6 dark:bg-dark-700">
            <DialogTitle className="dark:text-dark-100 text-base font-semibold text-gray-800">
              Adicionar chave de API
            </DialogTitle>
            <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
              A chave é validada e criptografada no servidor. Ela nunca é
              exibida por completo depois de salva.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                  Provedor
                </span>
                <select
                  value={providerId}
                  onChange={(e) => setEscolhido(e.target.value)}
                  className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                  Nome da conexão
                  <span className="ml-1 font-normal text-gray-400">
                    (opcional)
                  </span>
                </span>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Produção"
                  maxLength={80}
                  className="form-input dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
                  Chave de API
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-••••••••••••"
                  autoComplete="off"
                  className="form-input dark:border-dark-450 dark:bg-dark-700 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outlined" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onClick={salvar}
                disabled={saving || !providerId}
              >
                {saving ? "Validando…" : "Adicionar chave"}
              </Button>
            </div>
            <p className="dark:text-dark-300 mt-3 inline-flex items-center gap-1 text-xs text-gray-400">
              <ShieldCheckIcon className="size-4" />
              Chave validada e criptografada no servidor
            </p>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------

function ModalityPanel({
  modality,
  providers,
  creds,
  semChaves,
  onModelCount,
}: {
  modality: Modality;
  providers: CatalogProvider[];
  creds: AiCredential[];
  semChaves: boolean;
  onModelCount: (credentialId: string, delta: number) => void;
}) {
  const { adapter } = modality;
  const [conns, setConns] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credsDaModalidade = useMemo(
    () =>
      creds.filter((c) =>
        providers
          .find((p) => p.id === c.provider)
          ?.modalities.includes(modality.id),
      ),
    [creds, providers, modality.id],
  );

  const connsRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    connsRef.current = conns;
  }, [conns]);

  const credIds = creds.map((c) => c.id).join(",");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const lista = await adapter.list();
        if (alive) setConns(lista);
      } catch {
        if (alive) setConns([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Recarrega quando uma chave some (cascade no servidor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credIds]);

  const salvarOrdem = useCallback(
    async (nova: QueueItem[]) => {
      const anterior = connsRef.current;
      setError(null);
      setConns(nova);
      try {
        setConns(await adapter.reorder(nova.map((c) => c.id)));
      } catch (err) {
        setConns(anterior);
        setError(errMessage(err));
      }
    },
    [adapter],
  );

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) =>
          ehDragDaModalidade(source.data, modality.id),
        onDrop({ source, location }) {
          const alvo = location.current.dropTargets[0];
          if (!alvo) return;
          const atual = connsRef.current;
          const de = atual.findIndex((c) => c.id === source.data.id);
          const para = atual.findIndex((c) => c.id === alvo.data.id);
          if (de < 0 || para < 0) return;
          const nova = reorderWithEdge({
            list: atual,
            startIndex: de,
            indexOfTarget: para,
            closestEdgeOfTarget: extractClosestEdge(alvo.data),
            axis: "vertical",
          });
          if (nova.every((c, i) => c.id === atual[i].id)) return;
          void salvarOrdem(nova);
        },
      }),
    [modality.id, salvarOrdem],
  );

  const mover = (de: number, para: number) => {
    const atual = connsRef.current;
    if (para < 0 || para >= atual.length) return;
    const nova = [...atual];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    void salvarOrdem(nova);
  };

  const onRemove = async (conn: QueueItem) => {
    setError(null);
    try {
      await adapter.remove(conn.id);
      setConns(connsRef.current.filter((c) => c.id !== conn.id));
      onModelCount(conn.credentialId, -1);
    } catch (err) {
      setError(errMessage(err));
    }
  };

  const onAdded = (item: QueueItem) => {
    const atual = connsRef.current;
    if (atual.some((c) => c.id === item.id)) {
      setFormOpen(false);
      return;
    }
    setConns([...atual, item]);
    onModelCount(item.credentialId, 1);
    setFormOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 grid size-7 shrink-0 place-items-center rounded-lg">
          <modality.icon className="size-4.5" />
        </span>
        <h4 className="dark:text-dark-100 text-sm font-semibold text-gray-800">
          {modality.label}
        </h4>
        {conns.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <CheckCircleIcon className="size-3.5" />
            Conectado
            {conns.length > 1 && ` · ${conns.length} modelos`}
          </span>
        )}
      </div>

      {semChaves || loading ? null : (
        <div className="mt-4">
          {conns.length > 0 && (
            <>
              <ul className="dark:divide-dark-500 dark:border-dark-500 dark:bg-dark-600 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50">
                {conns.map((c, i) => (
                  <ModelRow
                    key={c.id}
                    conn={c}
                    index={i}
                    modalityId={modality.id}
                    titulo={nomeModelo(
                      providers,
                      c.provider,
                      modality.id,
                      c.model,
                    )}
                    subtitulo={`${rotuloCredencial(providers, c)} · ••••${c.keyLast4}`}
                    onRemove={onRemove}
                    onMover={mover}
                  />
                ))}
              </ul>
              <p className="dark:text-dark-300 mt-2 text-xs text-gray-400">
                Arraste para definir a ordem. Se um modelo falhar, o próximo
                assume automaticamente.
              </p>
            </>
          )}

          {conns.length === 0 && !formOpen && (
            <div className="dark:border-dark-500 dark:bg-dark-600 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                Nenhum modelo configurado
              </p>
              <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
                Adicione um modelo para utilizar esta modalidade.
              </p>
              <Button
                variant="outlined"
                color="primary"
                className="mt-3 h-8 text-xs"
                onClick={() => setFormOpen(true)}
                disabled={credsDaModalidade.length === 0}
              >
                Configurar modelos
              </Button>
              {credsDaModalidade.length === 0 && (
                <p className="dark:text-dark-300 mt-2 text-xs text-gray-400">
                  Nenhuma chave cadastrada oferece modelos de{" "}
                  {modality.label.toLowerCase()}.
                </p>
              )}
            </div>
          )}

          {formOpen && (
            <AddModelPanel
              modality={modality}
              providers={providers}
              creds={credsDaModalidade}
              jaNaFila={conns}
              onAdded={onAdded}
              onCancel={() => setFormOpen(false)}
            />
          )}

          {conns.length > 0 && !formOpen && (
            <Button
              variant="outlined"
              color="primary"
              className="mt-3 h-8 gap-1.5 text-xs"
              onClick={() => setFormOpen(true)}
              disabled={credsDaModalidade.length === 0}
            >
              <PlusIcon className="size-4" />
              Adicionar modelo
            </Button>
          )}

          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </div>
      )}
    </>
  );
}

function AddModelPanel({
  modality,
  providers,
  creds,
  jaNaFila,
  onAdded,
  onCancel,
}: {
  modality: Modality;
  providers: CatalogProvider[];
  creds: AiCredential[];
  jaNaFila: QueueItem[];
  onAdded: (item: QueueItem) => void;
  onCancel: () => void;
}) {
  const [credentialId, setCredentialId] = useState(creds[0]?.id ?? "");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cred = creds.find((c) => c.id === credentialId);

  const modelos = useMemo(() => {
    if (!cred) return [];
    const cat =
      providers
        .find((p) => p.id === cred.provider)
        ?.models.filter((m) => m.modality === modality.id) ?? [];
    return cat.filter(
      (m) =>
        !jaNaFila.some(
          (c) => c.credentialId === cred.id && c.model === m.id,
        ),
    );
  }, [cred, providers, modality.id, jaNaFila]);

  useEffect(() => {
    setModel(modelos[0]?.id ?? "");
  }, [credentialId, modelos]);

  const salvar = async () => {
    setError(null);
    if (!credentialId || !model) {
      setError("Escolha a conexão e o modelo.");
      return;
    }
    setSaving(true);
    try {
      onAdded(await modality.adapter.add({ credentialId, model }));
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dark:border-dark-500 dark:bg-dark-600 mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
            Conexão
          </span>
          <select
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {creds.map((c) => (
              <option key={c.id} value={c.id}>
                {rotuloCredencial(providers, c)} · ••••{c.keyLast4}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="dark:text-dark-200 mb-1 block font-medium text-gray-600">
            Modelo
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="form-select dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {modelos.length === 0 ? (
              <option value="">Todos os modelos já estão na fila</option>
            ) : (
              modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <Button
          color="primary"
          onClick={salvar}
          disabled={saving || !model}
          className="h-8 text-xs"
        >
          {saving ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button variant="flat" onClick={onCancel} className="h-8 text-xs">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ModelRow({
  conn,
  index,
  modalityId,
  titulo,
  subtitulo,
  onRemove,
  onMover,
}: {
  conn: QueueItem;
  index: number;
  modalityId: string;
  titulo: string;
  subtitulo: string;
  onRemove: (conn: QueueItem) => void;
  onMover: (de: number, para: number) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [edge, setEdge] = useState<Edge | null>(null);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    const element = rowRef.current;
    const dragHandle = handleRef.current;
    if (!element || !dragHandle) return;

    const data: DragData = {
      tipo: DRAG_TIPO,
      modalidade: modalityId,
      id: conn.id,
    };

    return combine(
      draggable({
        element,
        dragHandle,
        getInitialData: () => ({ ...data }),
        onDragStart: () => setArrastando(true),
        onDrop: () => setArrastando(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => ehDragDaModalidade(source.data, modalityId),
        getData: ({ input, element: alvo }) =>
          attachClosestEdge(
            { ...data },
            { input, element: alvo, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [conn.id, modalityId]);

  return (
    <li
      ref={rowRef}
      className={clsx(
        "relative flex flex-wrap items-center gap-3 px-3 py-2.5",
        arrastando && "opacity-40",
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Reordenar ${titulo} (use Alt e as setas para mover)`}
        onKeyDown={(e) => {
          if (!e.altKey) return;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onMover(index, index - 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onMover(index, index + 1);
          }
        }}
        className="dark:text-dark-300 dark:hover:text-dark-100 -m-1 shrink-0 cursor-grab p-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
      >
        <Bars2Icon className="size-4" />
      </button>

      <span
        className={clsx(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          index === 0
            ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
            : "dark:bg-dark-500 dark:text-dark-200 bg-gray-200 text-gray-600",
        )}
      >
        {index === 0 ? "1 · Principal" : index + 1}
      </span>

      <div className="min-w-0 flex-1 text-sm">
        <span className="dark:text-dark-100 font-medium text-gray-700">
          {titulo}
        </span>
        <span className="dark:text-dark-300 ml-2 text-gray-400">
          {subtitulo}
        </span>
      </div>

      <Button
        variant="flat"
        color="error"
        isIcon
        className="size-7 rounded-lg"
        aria-label={`Remover ${titulo}`}
        onClick={() => onRemove(conn)}
      >
        <TrashIcon className="size-4" />
      </Button>

      {edge && <DropIndicator edge={edge} />}
    </li>
  );
}
