// Import Dependencies
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { getCurrentProduct, type Squad } from "@/app/navigation/ceoOs";
import { navigationIcons } from "@/app/navigation/icons";
import { Spinner } from "@/components/ui";
import {
  fetchSquadDetailApi,
  type SquadAgent,
  type SquadDetail as SquadDetailData,
} from "@/services/api/squads";
import { useSquadsContext } from "@/app/contexts/squads/context";
import { useChatsContext } from "@/app/contexts/chats/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useDocumentsContext } from "@/app/contexts/documents/context";
import type { SquadDocument } from "@/app/contexts/documents/context";
import {
  avisarFalhaMemoria,
  salvarDocumentoNoGrupo,
} from "./memoria-grupos";
import {
  SidePanel,
  DocumentPreviewModal,
  type SidePanelTab,
} from "./SidePanel";
import { PromptBar } from "./PromptBar";
import { streamSquadChat } from "@/services/api/ai";

// ----------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Agente que respondeu, quando assistant. */
  agentReference?: string;
  /** Texto da pergunta do usuário que originou esta resposta (assistant). */
  sourcePrompt?: string;
  /** Id do documento gerado a partir desta mensagem, quando houver. */
  documentId?: string;
}

function nextId() {
  return `msg_${Math.random().toString(36).slice(2, 10)}`;
}

export default function SquadDetail() {
  const { pathname } = useLocation();
  const { squadSlug } = useParams();
  const product = getCurrentProduct(pathname);
  const { getSquadBySlug, catalogLoading } = useSquadsContext();
  const squad = squadSlug ? getSquadBySlug(squadSlug) : undefined;
  const { addChat, chatsByProduct, getChat, linkConversa } = useChatsContext();
  const { getProject } = useProjectsContext();
  const { addDocument, documentsBySquad } = useDocumentsContext();
  const navigate = useNavigate();

  // Detalhe do squad (descrição, agentes, perguntas) carregado da API.
  const [detail, setDetail] = useState<SquadDetailData | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Conversa em memória — reseta quando o usuário troca de squad.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<SquadAgent | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  // Id da conversa persistida no backend (definido após a 1ª resposta).
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [pendingAgent, setPendingAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("history");
  const [previewDoc, setPreviewDoc] = useState<SquadDocument | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset ao trocar de squad.
  useEffect(() => {
    setMessages([]);
    setSelectedAgent(null);
    setChatId(null);
    setConversaId(null);
    setPendingAgent(null);
  }, [squad?.id]);

  // Carrega o detalhe do squad da API ao entrar / trocar de squad.
  useEffect(() => {
    if (!squad) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    fetchSquadDetailApi(squad.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled)
          setDetailError("Não foi possível carregar este squad. Tente novamente.");
      });
    return () => {
      cancelled = true;
    };
  }, [squad?.id]);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingAgent]);

  if (!squad) {
    // Catálogo ainda carregando: aguarda antes de decidir se o slug é válido.
    if (catalogLoading) {
      return (
        <Page title={product.name}>
          <div className="flex h-full items-center justify-center py-16">
            <Spinner color="primary" className="size-6" />
          </div>
        </Page>
      );
    }
    return <Navigate to={`/${product.code}/insights`} replace />;
  }

  const Icon = navigationIcons[squad.icon];
  const isEmpty = messages.length === 0;

  // Chats deste squad (ordenados pelo provider — mais recentes primeiro).
  const squadChats = chatsByProduct(product.code).filter(
    (c) => c.squadId === squad.id,
  );
  const squadDocs = documentsBySquad(squad.id);

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Cria entrada no histórico na primeira mensagem da sessão.
    let localChatId = chatId;
    if (!localChatId) {
      const chat = addChat({
        product: product.code,
        title: trimmed,
        squadName: squad.title,
        squadId: squad.id,
        agentId: selectedAgent?.id,
        agentReference: selectedAgent?.reference,
        firstMessage: trimmed,
      });
      localChatId = chat.id;
      setChatId(chat.id);
    }

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      text: trimmed,
    };

    // Histórico enviado ao backend (inclui a mensagem atual do usuário).
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const replyAgent = selectedAgent?.reference ?? squad.title;
    const assistantId = nextId();

    // Adiciona a mensagem do usuário + um placeholder do assistente (vazio).
    setMessages((m) => [
      ...m,
      userMsg,
      {
        id: assistantId,
        role: "assistant",
        agentReference: replyAgent,
        sourcePrompt: trimmed,
        text: "",
      },
    ]);
    setPendingAgent(replyAgent);

    // Streaming da resposta real (Claude via backend). Envia o conversaId atual
    // (continua a mesma conversa) ou nenhum (cria uma nova no backend).
    streamSquadChat(
      {
        squadId: squad.id,
        agentId: selectedAgent?.id,
        conversaId: conversaId ?? undefined,
        messages: history,
      },
      (chunk) => {
        // No primeiro token, esconde o indicador de "digitando".
        setPendingAgent(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + chunk } : m,
          ),
        );
      },
    )
      .then((res) => {
        // Persiste o vínculo do histórico local com a conversa do backend, para
        // poder resgatá-la depois (mensagens reais, não mais mock).
        if (res?.conversaId) {
          setConversaId(res.conversaId);
          if (localChatId) linkConversa(localChatId, res.conversaId);
        }
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Erro ao gerar resposta.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.text
              ? { ...m, text: `⚠️ ${msg}` }
              : m,
          ),
        );
      })
      .finally(() => setPendingAgent(null));
  };

  /** Salva uma resposta como documento e marca a mensagem com o docId. */
  const handleSaveAsDocument = (msg: ChatMessage) => {
    if (msg.role !== "assistant" || msg.documentId) return;
    // Quando a conversa pertence a um grupo, o documento pertence ao grupo — e
    // por isso também vira .md na pasta do grupo no Repositório.
    const chat = chatId ? getChat(chatId) : undefined;
    const grupo = chat?.projectId ? getProject(chat.projectId) : undefined;
    const title =
      msg.sourcePrompt ?? `Documento de ${msg.agentReference ?? squad.title}`;
    const doc = addDocument({
      product: product.code,
      squadId: squad.id,
      squadName: squad.title,
      agentReference: msg.agentReference,
      chatId: chatId ?? undefined,
      projectId: grupo?.id,
      title,
      content: msg.text,
    });
    if (grupo) {
      salvarDocumentoNoGrupo({
        grupo: grupo.title,
        titulo: title,
        conteudo: msg.text,
        origem: [squad.title, msg.agentReference].filter(Boolean).join(" · "),
      }).then((r) => {
        if (!r.ok) avisarFalhaMemoria(r.reason);
      });
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, documentId: doc.id } : m,
      ),
    );
    // Abre a aba de documentos pra dar feedback visual.
    setActiveTab("documents");
  };

  const handleReset = () => {
    setMessages([]);
    setChatId(null);
    setConversaId(null);
    setPendingAgent(null);
  };

  return (
    <Page title={`${squad.title} · ${product.name}`}>
      {/* Layout: coluna do chat à esquerda + painel lateral à direita. */}
      <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho fixo */}
        <header className="dark:border-dark-500 dark:bg-dark-750 sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-(--margin-x) py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 grid size-9 shrink-0 place-items-center rounded-lg">
              {Icon && <Icon className="size-5 stroke-[1.5]" />}
            </div>
            <div className="min-w-0">
              <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
                Squad
              </p>
              <h1 className="dark:text-dark-50 truncate text-sm font-semibold text-gray-800">
                {squad.title}
                {selectedAgent && (
                  <span className="dark:text-dark-300 font-normal text-gray-500">
                    {" · "}
                    <span className="dark:text-dark-100 text-gray-700">
                      {selectedAgent.reference}
                    </span>
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {selectedAgent && (
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                title="Falar com o squad inteiro"
                className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <XMarkIcon className="size-3.5" />
                Conversar com o squad
              </button>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                title="Nova conversa"
                className="dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <ArrowPathIcon className="size-3.5" />
                Nova conversa
              </button>
            )}
          </div>
        </header>

        {/* Área de conversa rolável */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-(--margin-x) py-6">
            {isEmpty ? (
              detailError ? (
                <div className="dark:text-dark-300 py-16 text-center text-sm text-gray-500">
                  {detailError}
                </div>
              ) : !detail ? (
                <div className="flex justify-center py-16">
                  <Spinner color="primary" className="size-6" />
                </div>
              ) : (
                <EmptyState
                  squad={squad}
                  detail={detail}
                  selectedAgent={selectedAgent}
                  onSelectAgent={(a) => setSelectedAgent(a)}
                  onPickQuestion={(q) => handleSubmit(q)}
                  onPickAction={(a) => handleSubmit(a)}
                />
              )
            ) : (
              <MessageList
                messages={messages}
                pendingAgent={pendingAgent}
                squadTitle={squad.title}
                onSaveAsDocument={handleSaveAsDocument}
              />
            )}
          </div>
        </div>

        {/* Caixa de envio */}
        <PromptBar
          placeholder={
            selectedAgent
              ? `Pergunte a ${selectedAgent.reference}…`
              : `Pergunte ao squad ${squad.title}…`
          }
          hint={selectedAgent?.reference ?? squad.title}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Painel lateral: Histórico + Documentos (sempre visível) */}
      <SidePanel
        activeTab={activeTab}
        onTabChange={setActiveTab}
        chats={squadChats}
        documents={squadDocs}
        onOpenChat={(c) => navigate(`/${product.code}/historico/${c.id}`)}
        onOpenDocument={(d) => setPreviewDoc(d)}
        emptyChatsText="As conversas com este squad aparecem aqui."
      />
      </div>

      <DocumentPreviewModal
        document={previewDoc}
        close={() => setPreviewDoc(null)}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

interface EmptyStateProps {
  squad: Squad;
  detail: SquadDetailData;
  selectedAgent: SquadAgent | null;
  onSelectAgent: (agent: SquadAgent) => void;
  onPickQuestion: (q: string) => void;
  onPickAction: (a: string) => void;
}

function EmptyState({
  squad,
  detail,
  selectedAgent,
  onSelectAgent,
  onPickQuestion,
  onPickAction,
}: EmptyStateProps) {
  return (
    <div>
      <div className="text-center">
        <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 inline-flex size-12 items-center justify-center rounded-lg">
          <SparklesIcon className="size-5 stroke-[1.5]" />
        </div>
        <h2 className="dark:text-dark-50 mt-3 text-lg font-semibold text-gray-800">
          {squad.title}
        </h2>
        <p className="dark:text-dark-200 mx-auto mt-2 max-w-xl text-sm text-gray-600">
          {detail.description}
        </p>
      </div>

      {/* Agentes */}
      <section className="mt-7">
        <h3 className="dark:text-dark-300 mb-1 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
          Membros do squad
        </h3>
        <p className="dark:text-dark-400 mb-2 max-w-xl text-xs text-gray-400">
          Não são as pessoas reais. São decisões e orientações geradas com base
          no perfil e no conteúdo publicado por elas.
        </p>
        <div className="flex flex-wrap gap-2">
          {detail.agents.map((agent) => {
            const active = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent)}
                className={clsx(
                  "rounded-lg border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "dark:border-dark-500 dark:text-dark-200 dark:hover:border-primary-500/50 dark:hover:text-primary-300 border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-600",
                )}
              >
                <span className="font-medium">{agent.reference}</span>
                <span
                  className={clsx(
                    "ml-1.5",
                    active
                      ? "text-white/80"
                      : "dark:text-dark-400 text-gray-400",
                  )}
                >
                  · {agent.position}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Perguntas + Ações empilhadas (cada uma maximizável/minimizável) */}
      <div className="mt-6 flex flex-col gap-6">
        {/* Perguntas — inicia minimizada */}
        <CollapsibleSection
          title="Perguntas para começar"
          count={detail.starterQuestions.length}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {detail.starterQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickQuestion(q)}
                className="dark:border-dark-500 dark:bg-dark-700 dark:hover:bg-dark-600 dark:text-dark-100 flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-start text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50/40 dark:hover:border-primary-500/40"
              >
                <ChatBubbleLeftRightIcon className="text-primary-500 mt-0.5 size-4 shrink-0 stroke-[1.75]" />
                <span className="min-w-0 flex-1">{q}</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Ações — inicia maximizada */}
        {detail.starterActions.length > 0 && (
          <CollapsibleSection
            title="Ações que a IA pode executar"
            count={detail.starterActions.length}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {detail.starterActions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickAction(a)}
                  className="dark:border-dark-500 dark:bg-dark-700 dark:hover:bg-dark-600 dark:text-dark-100 flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-start text-sm text-gray-700 transition-colors hover:border-amber-300 hover:bg-amber-50/40 dark:hover:border-amber-500/40"
                >
                  <BoltIcon className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-amber-500" />
                  <span className="min-w-0 flex-1">{a}</span>
                </button>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

/**
 * Seção recolhível (maximizar/minimizar). O cabeçalho funciona como botão
 * de toggle e exibe um contador de itens. `defaultOpen` define o estado
 * inicial — perguntas iniciam minimizadas, ações iniciam maximizadas.
 */
function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Minimizar" : "Maximizar"}
        className="dark:text-dark-300 dark:hover:text-dark-100 mb-2 flex w-full items-center gap-2 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase transition-colors hover:text-gray-700"
      >
        <ChevronDownIcon
          className={clsx(
            "size-4 shrink-0 stroke-[2] transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="flex-1 text-start">{title}</span>
        <span className="dark:bg-dark-600 dark:text-dark-200 rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-gray-500">
          {count}
        </span>
      </button>
      {open && children}
    </section>
  );
}

// ----------------------------------------------------------------------

function MessageList({
  messages,
  pendingAgent,
  squadTitle,
  onSaveAsDocument,
}: {
  messages: ChatMessage[];
  pendingAgent: string | null;
  squadTitle: string;
  onSaveAsDocument: (m: ChatMessage) => void;
}) {
  return (
    <div className="space-y-4">
      {messages
        .filter((m) => m.role === "user" || m.text.length > 0)
        .map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            squadTitle={squadTitle}
            onSaveAsDocument={onSaveAsDocument}
          />
        ))}
      {pendingAgent && (
        <div className="flex justify-start">
          <div className="dark:border-dark-500 dark:bg-dark-700 max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-2 text-sm">
            <p className="dark:text-dark-300 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
              {pendingAgent}
            </p>
            <div className="mt-1.5 flex gap-1">
              <span className="bg-primary-500 size-1.5 animate-bounce rounded-full" />
              <span
                className="bg-primary-500 size-1.5 animate-bounce rounded-full"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="bg-primary-500 size-1.5 animate-bounce rounded-full"
                style={{ animationDelay: "240ms" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  squadTitle,
  onSaveAsDocument,
}: {
  message: ChatMessage;
  squadTitle: string;
  onSaveAsDocument: (m: ChatMessage) => void;
}) {
  const isUser = message.role === "user";
  const saved = Boolean(message.documentId);
  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary-500 dark:bg-primary-600 rounded-tr-sm text-white"
            : "dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100 rounded-tl-sm border border-gray-200 bg-white text-gray-800",
        )}
      >
        <p
          className={clsx(
            "text-tiny-plus font-semibold tracking-wider uppercase",
            isUser ? "text-white/70" : "dark:text-dark-300 text-gray-500",
          )}
        >
          {isUser ? "Você" : message.agentReference ?? squadTitle}
        </p>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">
          {message.text}
        </p>
        {!isUser && (
          <div className="dark:border-dark-500 mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => onSaveAsDocument(message)}
              disabled={saved}
              className={clsx(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                saved
                  ? "dark:text-dark-300 cursor-default text-gray-400"
                  : "text-primary-600 dark:text-primary-400 dark:hover:bg-primary-500/10 hover:bg-primary-50",
              )}
              title={saved ? "Já salvo" : "Salvar como documento"}
            >
              <DocumentTextIcon className="size-3.5 stroke-[1.75]" />
              {saved ? "Salvo como documento" : "Salvar como documento"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

