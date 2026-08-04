// Import Dependencies
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  EnvelopeIcon,
  HashtagIcon,
  LinkIcon,
  PaperClipIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Badge } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useChatsContext } from "@/app/contexts/chats/context";
import { useDocumentsContext } from "@/app/contexts/documents/context";
import type { SquadDocument } from "@/app/contexts/documents/context";
import {
  connectorByCode,
  formatBytes,
  memoryById,
  memoryCategoryLabels,
} from "@/app/contexts/projects/data";
import { SidebarListItem } from "@/app/layouts/Sideblock/Sidebar/Menu/SidebarListItem";
import {
  SidePanel,
  DocumentPreviewModal,
  type SidePanelTab,
} from "./SidePanel";
import { PromptBar } from "./PromptBar";
import { useMoverChatParaGrupo } from "./useGrupoMemoria";

// ----------------------------------------------------------------------

const chatDeleteMessages = {
  pending: {
    title: "Excluir chat?",
    description:
      "Tem certeza de que deseja excluir este chat? Esta ação não pode ser desfeita.",
    actionText: "Excluir",
  },
};

export default function ProjectDetail() {
  const { pathname } = useLocation();
  const { projectId } = useParams();
  const product = getCurrentProduct(pathname);
  const navigate = useNavigate();
  const {
    getProject,
    projectsByProduct,
    removeEmailFromProject,
    removeSlackFromProject,
  } = useProjectsContext();
  const { chatsByProject, addChat, renameChat, removeChat } = useChatsContext();
  const { documentsByProject } = useDocumentsContext();
  const moverChatParaGrupo = useMoverChatParaGrupo();

  const [activeTab, setActiveTab] = useState<SidePanelTab>("history");
  const [previewDoc, setPreviewDoc] = useState<SquadDocument | null>(null);

  const project = projectId ? getProject(projectId) : undefined;
  const groupChats = projectId ? chatsByProject(projectId) : [];
  const groups = projectsByProduct(product.code).map((p) => ({
    id: p.id,
    title: p.title,
  }));
  // Documentos do grupo = documentos salvos neste grupo (igual ao squad, que
  // usa documentsBySquad). Só são registrados quando salvos explicitamente.
  const groupDocs = projectId ? documentsByProject(projectId) : [];

  // Inicia uma conversa já vinculada a este grupo e abre a conversa.
  const handleStartChat = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !project) return;
    const chat = addChat({
      product: product.code,
      title: trimmed,
      firstMessage: trimmed,
      projectId: project.id,
    });
    navigate(`/${product.code}/historico/${chat.id}`);
  };

  if (!project) {
    return (
      <Page title={`Grupo · ${product.name}`}>
        <div className="transition-content w-full px-(--margin-x) py-6">
          <div className="dark:border-dark-600 dark:bg-dark-700 grid h-64 place-items-center rounded-lg border border-dashed border-gray-300 bg-white">
            <p className="dark:text-dark-300 text-sm text-gray-400">
              Grupo não encontrado.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  const hasSources =
    project.connectorCodes.length > 0 ||
    project.links.length > 0 ||
    project.files.length > 0;

  return (
    <Page title={`${project.title} · ${product.name}`}>
      {/* Layout: conteúdo do grupo à esquerda + painel lateral à direita. */}
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
          <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex flex-col gap-1">
          <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
            Grupos
          </p>
          <h2 className="dark:text-dark-50 text-2xl font-semibold tracking-wide text-gray-800">
            {project.title}
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Instruções">
            {project.instructions ? (
              <p className="dark:text-dark-200 text-sm whitespace-pre-line text-gray-600">
                {project.instructions}
              </p>
            ) : (
              <Empty>Sem instruções.</Empty>
            )}
          </Card>

          <Card title="Memória">
            {project.memoryIds.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {project.memoryIds.map((id) => {
                  const item = memoryById(id);
                  if (!item) return null;
                  return (
                    <li key={id} className="flex items-start gap-2">
                      <CpuChipIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                            {item.title}
                          </span>
                          <Badge
                            color="primary"
                            variant="soft"
                            className="shrink-0 text-tiny"
                          >
                            {memoryCategoryLabels[item.cat]}
                          </Badge>
                        </div>
                        <p className="dark:text-dark-300 text-xs text-gray-500">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nenhum item de memória vinculado.</Empty>
            )}
          </Card>

          {/* E-mails salvos neste grupo pela página de E-mail. */}
          <Card title="E-mails" className="lg:col-span-2">
            {project.emails.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {project.emails.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <EnvelopeIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                          {e.assunto}
                        </span>
                        <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
                          {new Date(e.data).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="dark:text-dark-300 truncate text-xs text-gray-500">
                        {e.remetente}
                      </p>
                      <p className="dark:text-dark-300 mt-1 line-clamp-3 text-xs whitespace-pre-line text-gray-500">
                        {e.corpo}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEmailFromProject(project.id, e.id)}
                      aria-label={`Remover o e-mail “${e.assunto}” do grupo`}
                      title="Remover do grupo"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Nenhum e-mail salvo. Use “Salvar no Grupo” na página de E-mail.
              </Empty>
            )}
          </Card>

          {/* Mensagens e threads salvas neste grupo pela página de Slack. */}
          <Card title="Slack" className="lg:col-span-2">
            {project.slack.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {project.slack.map((s) => (
                  <li key={s.id} className="flex items-start gap-2">
                    <HashtagIcon className="dark:text-dark-300 mt-0.5 size-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                          {s.origem}
                        </span>
                        <Badge
                          color={s.tipo === "thread" ? "info" : "primary"}
                          variant="soft"
                          className="shrink-0 text-tiny"
                        >
                          {s.tipo === "thread" ? "Thread" : "Mensagem"}
                        </Badge>
                        <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
                          {new Date(s.data).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="dark:text-dark-300 truncate text-xs text-gray-500">
                        {s.autor}
                      </p>
                      <p className="dark:text-dark-300 mt-1 line-clamp-3 text-xs whitespace-pre-line text-gray-500">
                        {s.texto}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlackFromProject(project.id, s.id)}
                      aria-label={`Remover a conversa de ${s.origem} do grupo`}
                      title="Remover do grupo"
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Nenhuma conversa salva. Use “Salvar no Grupo” na página de Slack.
              </Empty>
            )}
          </Card>

          <Card title="Fontes" className="lg:col-span-2">
            {hasSources ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <SourceColumn icon={Squares2X2Icon} title="Conectores">
                  {project.connectorCodes.length > 0 ? (
                    project.connectorCodes.map((code) => {
                      const c = connectorByCode(code);
                      const Icon = c?.icon;
                      return (
                        <Row key={code}>
                          {Icon && (
                            <Icon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                          )}
                          <span className="truncate">{c?.name ?? code}</span>
                        </Row>
                      );
                    })
                  ) : (
                    <Empty>—</Empty>
                  )}
                </SourceColumn>

                <SourceColumn icon={LinkIcon} title="Links">
                  {project.links.length > 0 ? (
                    project.links.map((l) => (
                      <Row key={l}>
                        <span className="truncate font-mono text-xs">{l}</span>
                      </Row>
                    ))
                  ) : (
                    <Empty>—</Empty>
                  )}
                </SourceColumn>

                <SourceColumn icon={PaperClipIcon} title="Arquivos">
                  {project.files.length > 0 ? (
                    project.files.map((f) => (
                      <Row key={f.id}>
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="dark:text-dark-300 shrink-0 font-mono text-tiny text-gray-400">
                          {formatBytes(f.size)}
                        </span>
                      </Row>
                    ))
                  ) : (
                    <Empty>—</Empty>
                  )}
                </SourceColumn>
              </div>
            ) : (
              <Empty>Nenhuma fonte vinculada.</Empty>
            )}
          </Card>
        </div>
          </div>
          </div>
          <PromptBar
            placeholder={`Iniciar uma conversa no grupo ${project.title}…`}
            hint={project.title}
            onSubmit={handleStartChat}
          />
        </div>

        <SidePanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          chats={groupChats}
          documents={groupDocs}
          onOpenChat={(c) => navigate(`/${product.code}/historico/${c.id}`)}
          onOpenDocument={(d) => setPreviewDoc(d)}
          emptyChatsText="As conversas deste grupo aparecem aqui."
          emptyDocsText="Os documentos deste grupo aparecem aqui — salve uma resposta da conversa ou use “Enviar para o grupo” no AI Studio."
          renderChatItem={(c) => (
            <SidebarListItem
              to={`/${product.code}/historico/${c.id}`}
              title={c.title}
              icon={ChatBubbleLeftRightIcon}
              onNavigate={() => {}}
              onRename={(title) => renameChat(c.id, title)}
              onDelete={() => removeChat(c.id)}
              renameLabel="Renomear chat"
              confirmMessages={chatDeleteMessages}
              groups={groups}
              currentGroupId={c.projectId}
              onMoveToGroup={(groupId) => moverChatParaGrupo(c.id, groupId)}
            />
          )}
        />
      </div>

      <DocumentPreviewModal
        document={previewDoc}
        close={() => setPreviewDoc(null)}
      />
    </Page>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`dark:border-dark-600 dark:bg-dark-700 rounded-lg border border-gray-200 bg-white p-4 ${className ?? ""}`}
    >
      <h3 className="dark:text-dark-100 text-sm font-semibold tracking-wide text-gray-800">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SourceColumn({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="dark:text-dark-200 mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-600 uppercase">
        <Icon className="size-4" /> {title}
      </div>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="dark:text-dark-200 flex items-center gap-2 text-sm text-gray-600">
      {children}
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dark:text-dark-400 text-sm text-gray-400">{children}</p>;
}
