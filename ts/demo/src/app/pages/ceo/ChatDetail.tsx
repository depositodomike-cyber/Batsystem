// Import Dependencies
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Spinner } from "@/components/ui";
import { getCurrentProduct, squadPath } from "@/app/navigation/ceoOs";
import { useChatsContext } from "@/app/contexts/chats/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useSquadsContext } from "@/app/contexts/squads/context";
import { fetchConversaApi } from "@/services/api/conversas";
import { streamSquadChat } from "@/services/api/ai";
import {
  avisarFalhaMemoria,
  salvarConversaNoGrupo,
  type MensagemConversa,
} from "./memoria-grupos";
import { PromptBar } from "./PromptBar";

// ----------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function nextId() {
  return `msg_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatDetail() {
  const { pathname } = useLocation();
  const { chatId } = useParams();
  const product = getCurrentProduct(pathname);
  const { getChat, linkConversa } = useChatsContext();
  const { getProject } = useProjectsContext();
  const { getSquadById } = useSquadsContext();

  const chat = chatId ? getChat(chatId) : undefined;
  // Grupo (agrupamento) da conversa: define a pasta do Contexto onde o .md vai.
  const grupo = chat?.projectId ? getProject(chat.projectId) : undefined;
  // Falha de gravação avisa uma vez por conversa — o resto fica silencioso para
  // não repetir o mesmo toast a cada turno.
  const avisouFalha = useRef(false);

  // Mensagens reais carregadas do backend + continuação ao vivo.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(
    chat?.conversaId ?? null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega a conversa persistida ao abrir / trocar de conversa.
  useEffect(() => {
    setMessages([]);
    setPending(false);
    const cid = chat?.conversaId ?? null;
    setConversaId(cid);
    avisouFalha.current = false;
    if (!cid) return;
    let cancelled = false;
    setLoading(true);
    fetchConversaApi(cid)
      .then((c) => {
        if (cancelled) return;
        setMessages(
          c.messages.map((m) => ({ id: m.id, role: m.role, text: m.text })),
        );
      })
      .catch(() => {
        /* mantém o fallback (firstMessage) se a leitura falhar */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, chat?.conversaId]);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

  if (!chat) {
    return (
      <Page title={`Histórico · ${product.name}`}>
        <div className="transition-content w-full px-(--margin-x) py-6">
          <div className="dark:border-dark-600 dark:bg-dark-700 grid h-64 place-items-center rounded-lg border border-dashed border-gray-300 bg-white">
            <p className="dark:text-dark-300 text-sm text-gray-400">
              Conversa não encontrada.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  const squad = chat.squadId ? getSquadById(chat.squadId) : undefined;
  const replyAuthor = chat.agentReference ?? chat.squadName ?? "Assistente";
  // Mostra a 1ª mensagem só no modo fallback (sem conversa do backend), para
  // não duplicar — quando há backend, ela já vem na lista de mensagens.
  const showFirstMessage = !conversaId && !!chat.firstMessage;

  // Conversa de grupo vira .md na pasta do grupo a cada resposta: o arquivo tem
  // o nome da conversa, então é sempre a conversa inteira, regravada.
  const salvarNoGrupo = (mensagens: MensagemConversa[]) => {
    if (!grupo || !mensagens.some((m) => m.text.trim())) return;
    salvarConversaNoGrupo({
      grupo: grupo.title,
      titulo: chat.title,
      mensagens,
      autor: replyAuthor,
    }).then((r) => {
      if (r.ok || avisouFalha.current) return;
      avisouFalha.current = true;
      avisarFalhaMemoria(r.reason);
    });
  };

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !chat.squadId) return;

    const userId = nextId();
    const assistantId = nextId();

    // Histórico enviado ao backend para contexto (inclui a pergunta atual).
    const history = [
      ...(showFirstMessage && messages.length === 0
        ? [{ role: "user" as const, text: chat.firstMessage! }]
        : []),
      ...messages.map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: trimmed },
    ];

    setMessages((m) => [
      ...m,
      { id: userId, role: "user", text: trimmed },
      { id: assistantId, role: "assistant", text: "" },
    ]);
    setPending(true);

    // Texto acumulado da resposta — é o que fecha o transcript gravado na
    // pasta do Contexto do grupo (o estado das mensagens é assíncrono demais
    // para servir de fonte aqui).
    let resposta = "";

    streamSquadChat(
      {
        squadId: chat.squadId,
        agentId: chat.agentId,
        conversaId: conversaId ?? undefined,
        messages: history,
      },
      (chunk) => {
        setPending(false);
        resposta += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + chunk } : m,
          ),
        );
      },
    )
      .then((res) => {
        if (res?.conversaId) {
          setConversaId(res.conversaId);
          if (chatId && !chat.conversaId) linkConversa(chatId, res.conversaId);
        }
        salvarNoGrupo([...history, { role: "assistant", text: resposta }]);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Erro ao gerar resposta.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.text ? { ...m, text: `⚠️ ${msg}` } : m,
          ),
        );
      })
      .finally(() => setPending(false));
  };

  return (
    <Page title={`${chat.title} · ${product.name}`}>
      <div className="flex h-full min-h-0 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="transition-content mx-auto w-full max-w-3xl px-(--margin-x) py-6">
            <div className="flex flex-col gap-1">
              <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
                Histórico
                {chat.squadName ? (
                  <>
                    {" · "}
                    {squad ? (
                      <Link to={squadPath(squad)} className="hover:underline">
                        {chat.squadName}
                      </Link>
                    ) : (
                      chat.squadName
                    )}
                  </>
                ) : null}
                {chat.agentReference ? ` · ${chat.agentReference}` : ""}
              </p>
              <h2 className="dark:text-dark-50 text-2xl font-semibold tracking-wide text-gray-800">
                {chat.title}
              </h2>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {showFirstMessage && (
                <Bubble role="user" text={chat.firstMessage!} />
              )}
              {loading && messages.length === 0 && (
                <div className="flex justify-center py-6">
                  <Spinner color="primary" className="size-5" />
                </div>
              )}
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} text={m.text} />
              ))}
              {pending && (
                <div className="dark:text-dark-300 text-sm text-gray-400">
                  {replyAuthor} está digitando…
                </div>
              )}
            </div>
          </div>
        </div>

        <PromptBar
          placeholder={`Continuar a conversa “${chat.title}”…`}
          hint={chat.squadName ?? "Conversa"}
          onSubmit={handleSubmit}
        />
      </div>
    </Page>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary-500 dark:bg-primary-600 max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2 text-sm whitespace-pre-line text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="dark:border-dark-500 dark:bg-dark-700 dark:text-dark-100 max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-2 text-sm whitespace-pre-line text-gray-800">
        {text}
      </div>
    </div>
  );
}
