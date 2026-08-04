// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  CpuChipIcon,
  LinkIcon,
  PaperClipIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { ReactNode, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

// Local Imports
import { Badge, Button } from "@/components/ui";
import { useProjectsContext } from "@/app/contexts/projects/context";
import type { ProjectFile } from "@/app/contexts/projects/context";
import {
  connectorByCode,
  connectorsMock,
  formatBytes,
  memoryCategoryLabels,
  memoryMock,
} from "@/app/contexts/projects/data";
import {
  avisarFalhaMemoria,
  criarPastaDoGrupo,
} from "@/app/pages/ceo/memoria-grupos";
import { memoriaVaultSupported } from "@/utils/memoriaVault";

// ----------------------------------------------------------------------

export interface CreateProjectModalProps {
  isOpen: boolean;
  close: () => void;
  /** Produto ao qual o agrupamento pertence. */
  product: string;
}

const inputBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 dark:placeholder:text-dark-300 dark:focus:border-primary-500";

export function CreateProjectModal({
  isOpen,
  close,
  product,
}: CreateProjectModalProps) {
  return (
    <Transition
      appear
      show={isOpen}
      as={Dialog}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-5"
      onClose={close}
    >
      <TransitionChild
        as="div"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity dark:bg-black/50"
      />

      <TransitionChild
        as={DialogPanel}
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
        className="dark:bg-dark-700 relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl transition-all"
      >
        {/* Recria o formulário a cada abertura para limpar o estado. */}
        {isOpen && <CreateProjectForm close={close} product={product} />}
      </TransitionChild>
    </Transition>
  );
}

function CreateProjectForm({
  close,
  product,
}: {
  close: () => void;
  product: string;
}) {
  const { addProject } = useProjectsContext();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [connectorCodes, setConnectorCodes] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [memoryIds, setMemoryIds] = useState<string[]>([]);

  const toggleConnector = (code: string) =>
    setConnectorCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const toggleMemory = (id: string) =>
    setMemoryIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  const addLink = () => {
    const v = linkDraft.trim();
    if (!v || links.includes(v)) return;
    setLinks((prev) => [...prev, v]);
    setLinkDraft("");
  };

  const removeLink = (value: string) =>
    setLinks((prev) => prev.filter((l) => l !== value));

  const onFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...incoming.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        name: f.name,
        size: f.size,
      })),
    ]);
    e.target.value = "";
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const canSubmit = title.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const nome = title.trim();
    addProject({
      product,
      title: nome,
      instructions: instructions.trim(),
      connectorCodes,
      links,
      files,
      memoryIds,
    });

    // Todo grupo tem uma pasta própria na Memória: é ali que suas conversas e
    // documentos viram .md. Criamos aqui, ainda dentro do gesto do clique — é o
    // que permite pedir a permissão de escrita na Pasta da Memória.
    if (memoriaVaultSupported()) {
      criarPastaDoGrupo({
        titulo: nome,
        instrucoes: instructions.trim(),
        conectores: connectorCodes.map(
          (code) => connectorByCode(code)?.name ?? code,
        ),
        links,
        arquivos: files.map((f) => f.name),
      }).then((r) => {
        if (r.ok) {
          toast("Grupo criado", {
            description: `Pasta “${r.pasta}” criada na Memória.`,
          });
        } else {
          avisarFalhaMemoria(r.reason);
        }
      });
    }

    close();
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="dark:border-dark-600 flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <DialogTitle
            as="h3"
            className="dark:text-dark-100 text-lg font-semibold tracking-tight text-gray-800"
          >
            Novo grupo
          </DialogTitle>
          <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
            Um grupo é um espaço dedicado com instruções, fontes e memória
            própria.
          </p>
        </div>
        <Button
          onClick={close}
          isIcon
          variant="flat"
          className="size-8 shrink-0 rounded-full"
        >
          <XMarkIcon className="size-5" />
        </Button>
      </div>

      {/* Corpo rolável */}
      <form
        id="project-form"
        onSubmit={onSubmit}
        className="hide-scrollbar flex-1 space-y-6 overflow-y-auto px-5 py-5"
      >
        <Section title="Título" description="Como esse grupo será chamado.">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Plano de expansão LATAM"
            className={inputBase}
            autoFocus
            required
          />
        </Section>

        <Section
          title="Instruções"
          description="Contexto, objetivo e regras que devem orientar o trabalho dentro deste grupo."
        >
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex.: Quero acompanhar a expansão para México e Colômbia. Priorizar fontes em português e dados públicos verificáveis. Comunicação direta."
            rows={5}
            className={clsx(inputBase, "min-h-[120px] resize-y")}
          />
        </Section>

        <Section
          title="Fontes"
          description="De onde este grupo pode buscar conhecimento: conectores corporativos, links e arquivos."
        >
          <div className="space-y-4">
            {/* Conectores */}
            <div>
              <SubHeader icon={Squares2X2Icon}>Conectores</SubHeader>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {connectorsMock.map((c) => {
                  const checked = connectorCodes.includes(c.code);
                  const disabled = c.status !== "connected";
                  const Icon = c.icon;
                  return (
                    <label
                      key={c.code}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                        disabled
                          ? "dark:border-dark-500 dark:bg-dark-600 cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                          : "cursor-pointer",
                        !disabled && checked
                          ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10"
                          : !disabled &&
                              "dark:border-dark-500 dark:bg-dark-600 border-gray-200 bg-white hover:border-gray-300 dark:hover:border-dark-400",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary-500 size-4"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleConnector(c.code)}
                      />
                      <Icon className="dark:text-dark-100 size-4 shrink-0 text-gray-600" />
                      <span className="dark:text-dark-100 truncate text-gray-700">
                        {c.name}
                      </span>
                      {disabled && (
                        <Badge
                          color="neutral"
                          variant="soft"
                          className="ml-auto text-tiny"
                        >
                          desconectado
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Links */}
            <div>
              <SubHeader icon={LinkIcon}>Links</SubHeader>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLink();
                    }
                  }}
                  placeholder="https://..."
                  className={inputBase}
                />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={addLink}
                  className="shrink-0 gap-1"
                >
                  <PlusIcon className="size-4" /> Adicionar
                </Button>
              </div>
              {links.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {links.map((l) => (
                    <SourceRow
                      key={l}
                      icon={LinkIcon}
                      onRemove={() => removeLink(l)}
                      removeLabel={`Remover ${l}`}
                    >
                      <span className="dark:text-dark-100 flex-1 truncate font-mono text-xs text-gray-700">
                        {l}
                      </span>
                    </SourceRow>
                  ))}
                </ul>
              )}
            </div>

            {/* Arquivos */}
            <div>
              <SubHeader icon={PaperClipIcon}>Arquivos</SubHeader>
              <label className="dark:border-dark-500 dark:bg-dark-600 dark:text-dark-300 hover:border-primary-500 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500 transition-colors hover:text-gray-700">
                <PaperClipIcon className="size-4" />
                <span>Clique para escolher arquivos ou solte aqui.</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onFilesChange}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f) => (
                    <SourceRow
                      key={f.id}
                      icon={PaperClipIcon}
                      onRemove={() => removeFile(f.id)}
                      removeLabel={`Remover ${f.name}`}
                    >
                      <span className="dark:text-dark-100 flex-1 truncate text-gray-700">
                        {f.name}
                      </span>
                      <span className="dark:text-dark-300 shrink-0 font-mono text-tiny text-gray-400">
                        {formatBytes(f.size)}
                      </span>
                    </SourceRow>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Memória"
          description="Itens da memória executiva que devem alimentar este grupo. Selecione um a um."
        >
          {memoryMock.length === 0 ? (
            <p className="dark:text-dark-300 text-sm text-gray-500">
              Nenhum item de memória disponível ainda.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {memoryMock.map((m) => {
                const checked = memoryIds.includes(m.id);
                return (
                  <li key={m.id}>
                    <label
                      className={clsx(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                        checked
                          ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10"
                          : "dark:border-dark-500 dark:bg-dark-600 border-gray-200 bg-white hover:border-gray-300 dark:hover:border-dark-400",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary-500 mt-0.5 size-4"
                        checked={checked}
                        onChange={() => toggleMemory(m.id)}
                      />
                      <CpuChipIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                            {m.title}
                          </span>
                          <Badge
                            color="primary"
                            variant="soft"
                            className="shrink-0 text-tiny"
                          >
                            {memoryCategoryLabels[m.cat]}
                          </Badge>
                        </div>
                        <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-500">
                          {m.body}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </form>

      {/* Rodapé */}
      <div className="dark:border-dark-600 dark:bg-dark-750 flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3">
        <Button type="button" variant="flat" onClick={close}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="project-form"
          color="primary"
          disabled={!canSubmit}
        >
          Criar grupo
        </Button>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="dark:text-dark-300 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
          {title}
        </h4>
        {description && (
          <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function SubHeader({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: ReactNode;
}) {
  return (
    <div className="dark:text-dark-100 mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
      <Icon className="size-4" /> {children}
    </div>
  );
}

function SourceRow({
  icon: Icon,
  children,
  onRemove,
  removeLabel,
}: {
  icon: React.ElementType;
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <li className="dark:border-dark-500 dark:bg-dark-600 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm">
      <Icon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <TrashIcon className="size-4" />
      </button>
    </li>
  );
}
