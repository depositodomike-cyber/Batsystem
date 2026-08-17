// Import Dependencies
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowLeftIcon,
  ArrowLongRightIcon,
  ArrowUturnLeftIcon,
  AtSymbolIcon,
  ChatBubbleOvalLeftIcon,
  CheckIcon,
  ClockIcon,
  HandThumbUpIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HandThumbUpIcon as HandThumbUpSolidIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

// Local Imports
import becultureLogo from "@/assets/branding/beculture-logo.svg";
import becultureLogoDark from "@/assets/branding/beculture-logo-dark.svg";
import { Page } from "@/components/shared/Page";
import { Button, Card, Textarea } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  getArticleBody,
  getFeedItem,
  getMentionablePeople,
  getRelatedFeedItems,
  type FeedItem,
  type Person,
} from "@/app/data/feed";
import {
  connectorShareKind,
  shareableConnectors,
  type Connector,
} from "@/app/data/conectores";
import { INSIGHT_USUARIOS, type InsightUser } from "@/app/data/insights";
import { useLikesContext } from "@/app/contexts/likes/context";
import { useCommentsContext } from "@/app/contexts/comments/context";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import { useAuthContext } from "@/app/contexts/auth/context";
import type { FeedComment } from "@/app/contexts/comments/context";

// ----------------------------------------------------------------------

export default function FeedDetail() {
  const { pathname } = useLocation();
  const { feedId } = useParams();
  const product = getCurrentProduct(pathname);
  const base = `/${product.code}/feed`;

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const item = feedId ? getFeedItem(feedId) : undefined;

  // Notícia inexistente → volta para o feed.
  if (!item) {
    return <Navigate to={base} replace />;
  }

  const body = getArticleBody(item);
  const related = getRelatedFeedItems(item.id);

  const focusCommentInput = () => {
    const el = commentInputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  };

  return (
    <Page title={`${item.title} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-5">
        <div className="mx-auto max-w-3xl">
          {/* Voltar */}
          <Link
            to={base}
            className="dark:text-dark-300 dark:hover:text-dark-100 mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeftIcon className="size-4" />
            Voltar ao feed
          </Link>

          {/* Cabeçalho da notícia */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 rounded-full px-2.5 py-1 text-tiny font-semibold tracking-wide uppercase">
              {item.category}
            </span>
            <span className="dark:text-dark-300 inline-flex items-center gap-1 text-tiny text-gray-400">
              <ClockIcon className="size-3.5" />
              {item.readMinutes} min de leitura
            </span>
          </div>

          <h1 className="dark:text-dark-50 text-2xl font-bold tracking-tight text-gray-800 sm:text-3xl">
            {item.title}
          </h1>

          {/* Autor */}
          <div className="mt-4 flex items-center gap-3">
            <img
              src={item.face}
              alt={item.author}
              className="size-10 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="dark:text-dark-100 text-sm font-semibold text-gray-800">
                {item.author}
              </p>
              <p className="dark:text-dark-300 text-tiny text-gray-400">
                {item.authorRole} · {item.date}
              </p>
            </div>
          </div>

          {/* Imagem de capa */}
          <div className="mt-5 overflow-hidden rounded-xl">
            <img
              src={item.image}
              alt={item.title}
              className="aspect-video w-full object-cover"
            />
          </div>

          {/* Corpo do artigo */}
          <article className="mt-6 space-y-4">
            {body.map((block, i) => {
              switch (block.type) {
                case "lead":
                  return (
                    <p
                      key={i}
                      className="dark:text-dark-100 text-lg leading-relaxed font-medium text-gray-700"
                    >
                      {block.text}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      key={i}
                      className="dark:text-dark-50 pt-2 text-xl font-semibold text-gray-800"
                    >
                      {block.text}
                    </h2>
                  );
                case "quote":
                  return (
                    <blockquote
                      key={i}
                      className="border-primary-500 dark:text-dark-200 my-2 border-l-4 pl-4 text-base text-gray-600 italic"
                    >
                      “{block.text}”
                      <footer className="dark:text-dark-300 mt-1 text-sm text-gray-400 not-italic">
                        — {block.cite}
                      </footer>
                    </blockquote>
                  );
                default:
                  return (
                    <p
                      key={i}
                      className="dark:text-dark-200 leading-relaxed text-gray-600"
                    >
                      {block.text}
                    </p>
                  );
              }
            })}
          </article>

          {/* Barra de ações */}
          <div className="dark:border-dark-500 mt-7 flex items-center gap-2 border-t border-b border-gray-200 py-3">
            <LikePill item={item} />
            <CommentPill item={item} onClick={focusCommentInput} />
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="dark:text-dark-300 dark:hover:bg-dark-600 ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
            >
              <ShareIcon className="size-4" />
              Compartilhar
            </button>
          </div>

          {/* Comentários */}
          <CommentsSection item={item} inputRef={commentInputRef} />

          {/* Relacionadas */}
          {related.length > 0 && (
            <section className="mt-10">
              <h3 className="dark:text-dark-50 mb-4 text-lg font-semibold text-gray-800">
                Notícias relacionadas
              </h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {related.map((rel) => (
                  <RelatedCard key={rel.id} item={rel} base={base} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        item={item}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

function LikePill({ item }: { item: FeedItem }) {
  const { isLiked, toggleLike } = useLikesContext();
  const liked = isLiked(item.id);
  const count = item.likes + (liked ? 1 : 0);
  const Icon = liked ? HandThumbUpSolidIcon : HandThumbUpIcon;
  return (
    <button
      type="button"
      aria-label={liked ? "Remover curtida" : "Curtir"}
      aria-pressed={liked}
      onClick={() => toggleLike(item.id)}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        liked
          ? "bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300"
          : "dark:bg-dark-600 dark:text-dark-200 dark:hover:bg-dark-500 bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      <Icon className="size-4" />
      {count}
    </button>
  );
}

function CommentPill({
  item,
  onClick,
}: {
  item: FeedItem;
  onClick: () => void;
}) {
  const { commentCount } = useCommentsContext();
  const count = item.comments + commentCount(item.id);
  return (
    <button
      type="button"
      aria-label="Comentar"
      onClick={onClick}
      className="dark:bg-dark-600 dark:text-dark-200 dark:hover:bg-dark-500 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
    >
      <ChatBubbleOvalLeftIcon className="size-4" />
      {count}
    </button>
  );
}

// ----------------------------------------------------------------------
// Seção de comentários: composer + threads (com curtidas, menções e respostas).

function CommentsSection({
  item,
  inputRef,
}: {
  item: FeedItem;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const { topLevelByFeed, commentCount } = useCommentsContext();
  const threads = topLevelByFeed(item.id);
  const total = commentCount(item.id);

  return (
    <section className="mt-8">
      <h3 className="dark:text-dark-50 mb-4 text-lg font-semibold text-gray-800">
        Comentários
        {total > 0 && (
          <span className="dark:text-dark-300 ml-1.5 text-sm font-normal text-gray-400">
            ({total})
          </span>
        )}
      </h3>

      <CommentComposer feedId={item.id} inputRef={inputRef} />

      {threads.length > 0 && (
        <div className="mt-6 space-y-5">
          {threads.map((comment) => (
            <CommentThread key={comment.id} comment={comment} feedId={item.id} />
          ))}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------
// Composer com autocompletar de menções (@). Reutilizado no comentário
// principal e nas respostas.

function CommentComposer({
  feedId,
  parentId,
  placeholder = "Escreva um comentário…",
  initialText = "",
  autoFocus = false,
  compact = false,
  inputRef,
  onSubmitted,
}: {
  feedId: string;
  parentId?: string;
  placeholder?: string;
  initialText?: string;
  autoFocus?: boolean;
  compact?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSubmitted?: () => void;
}) {
  const { addComment } = useCommentsContext();
  const { user } = useAuthContext();
  const people = useMemo(getMentionablePeople, []);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState(initialText);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(
    null,
  );

  const authorName = user?.name?.trim() || "Você";
  const authorAvatar = user?.avatarUrl || "/images/avatar/avatar-12.jpg";

  useEffect(() => {
    if (autoFocus && taRef.current) {
      const el = taRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);

  const setRefs = (el: HTMLTextAreaElement | null) => {
    taRef.current = el;
    if (inputRef) inputRef.current = el;
  };

  // Detecta uma menção em andamento (texto após o último "@" antes do cursor).
  const updateMentionState = (value: string, caret: number) => {
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1) {
      setMention(null);
      return;
    }
    const between = upto.slice(at + 1);
    if (between.length > 25 || between.includes("\n") || between.includes("@")) {
      setMention(null);
      return;
    }
    setMention({ start: at, query: between });
  };

  const matches = mention
    ? people
        .filter((p) =>
          p.name.toLowerCase().includes(mention.query.toLowerCase().trim()),
        )
        .slice(0, 5)
    : [];

  const insertMention = (person: Person) => {
    if (!mention) return;
    const el = taRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const insert = `@${person.name} `;
    const next = before + insert + after;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment({
      feedId,
      parentId,
      text: trimmed,
      author: authorName,
      avatarUrl: authorAvatar,
    });
    setText("");
    setMention(null);
    onSubmitted?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter seleciona a primeira menção sugerida.
    if (
      mention &&
      matches.length > 0 &&
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      e.preventDefault();
      insertMention(matches[0]);
      return;
    }
    // Ctrl/Cmd + Enter envia.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === "Escape" && mention) {
      setMention(null);
    }
  };

  return (
    <div className="flex gap-3">
      <img
        src={authorAvatar}
        alt={authorName}
        className={clsx(
          "shrink-0 rounded-full object-cover",
          compact ? "size-8" : "size-9",
        )}
      />
      <div className="relative min-w-0 flex-1">
        <Textarea
          ref={setRefs}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateMentionState(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
            );
          }}
          onKeyDown={handleKeyDown}
          rows={compact ? 2 : 3}
          placeholder={placeholder}
        />

        {/* Dropdown de menções */}
        {mention && matches.length > 0 && (
          <ul className="dark:border-dark-500 dark:bg-dark-700 absolute z-20 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {matches.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  // onMouseDown para disparar antes do blur do textarea.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(p);
                  }}
                  className="dark:hover:bg-dark-600 flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-100"
                >
                  <img
                    src={p.avatarUrl}
                    alt={p.name}
                    className="size-6 rounded-full object-cover"
                  />
                  <span className="dark:text-dark-100 text-sm text-gray-700">
                    {p.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="dark:text-dark-300 inline-flex items-center gap-1 text-tiny text-gray-400">
            <AtSymbolIcon className="size-3.5" />
            use @ para marcar alguém
          </span>
          <Button
            type="button"
            color="primary"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="gap-1.5"
          >
            <PaperAirplaneIcon className="size-4" />
            {parentId ? "Responder" : "Comentar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Thread: comentário de topo + suas respostas indentadas.

function CommentThread({
  comment,
  feedId,
}: {
  comment: FeedComment;
  feedId: string;
}) {
  const { repliesOf } = useCommentsContext();
  const replies = repliesOf(comment.id);
  return (
    <div>
      <CommentRow comment={comment} feedId={feedId} rootId={comment.id} />
      {replies.length > 0 && (
        <div className="dark:border-dark-500 mt-3 ml-12 space-y-3 border-l border-gray-150 pl-3">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              feedId={feedId}
              rootId={comment.id}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  feedId,
  rootId,
  isReply = false,
}: {
  comment: FeedComment;
  feedId: string;
  rootId: string;
  isReply?: boolean;
}) {
  const { toggleCommentLike, removeComment } = useCommentsContext();
  const people = useMemo(getMentionablePeople, []);
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <div className="group flex gap-3">
      <img
        src={comment.avatarUrl}
        alt={comment.author}
        className={clsx(
          "shrink-0 rounded-full object-cover",
          isReply ? "size-8" : "size-9",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="dark:bg-dark-700 dark:border-dark-500 rounded-lg border border-gray-150 bg-gray-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="dark:text-dark-100 text-sm font-semibold text-gray-800">
              {comment.author}
            </p>
            <div className="flex items-center gap-2">
              <span className="dark:text-dark-300 text-tiny text-gray-400">
                {formatCommentDate(comment.createdAt)}
              </span>
              <button
                type="button"
                aria-label="Remover comentário"
                onClick={() => removeComment(comment.id)}
                className="dark:text-dark-300 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          </div>
          <p className="dark:text-dark-200 mt-0.5 text-sm whitespace-pre-wrap text-gray-600">
            {renderWithMentions(comment.text, people)}
          </p>
        </div>

        {/* Ações: curtir + responder */}
        <div className="mt-1 flex items-center gap-4 pl-1">
          <button
            type="button"
            aria-pressed={comment.likedByMe}
            aria-label={comment.likedByMe ? "Remover curtida" : "Curtir"}
            onClick={() => toggleCommentLike(comment.id)}
            className={clsx(
              "inline-flex items-center gap-1 text-tiny font-semibold transition-colors",
              comment.likedByMe
                ? "text-primary-600 dark:text-primary-400"
                : "dark:text-dark-300 text-gray-400 hover:text-gray-600",
            )}
          >
            {comment.likedByMe ? (
              <HandThumbUpSolidIcon className="size-3.5" />
            ) : (
              <HandThumbUpIcon className="size-3.5" />
            )}
            Curtir{comment.likes > 0 ? ` · ${comment.likes}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setReplyOpen((o) => !o)}
            className="dark:text-dark-300 inline-flex items-center gap-1 text-tiny font-semibold text-gray-400 transition-colors hover:text-gray-600"
          >
            <ArrowUturnLeftIcon className="size-3.5" />
            Responder
          </button>
        </div>

        {/* Composer de resposta */}
        {replyOpen && (
          <div className="mt-2">
            <CommentComposer
              feedId={feedId}
              parentId={rootId}
              compact
              autoFocus
              initialText={`@${comment.author} `}
              placeholder={`Responder a ${comment.author}…`}
              onSubmitted={() => setReplyOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Renderiza o texto destacando menções "@Nome" das pessoas conhecidas. */
function renderWithMentions(text: string, people: Person[]): ReactNode {
  if (people.length === 0) return text;
  const escaped = people
    .map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length); // nomes mais longos primeiro
  const re = new RegExp(`@(?:${escaped.join("|")})`, "g");
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span
        key={key++}
        className="text-primary-600 dark:text-primary-400 font-medium"
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Formata a data de criação de forma amigável (relativa ou absoluta). */
function formatCommentDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function RelatedCard({ item, base }: { item: FeedItem; base: string }) {
  const to = `${base}/${item.id}`;
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link to={to} className="h-[140px] shrink-0 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="size-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col px-4 py-3">
        <p className="text-primary-600 dark:text-primary-400 text-tiny font-semibold tracking-wide uppercase">
          {item.category}
        </p>
        <Link
          to={to}
          className="dark:text-dark-100 hover:text-primary-600 dark:hover:text-primary-400 mt-1 line-clamp-2 text-sm-plus font-semibold text-gray-800"
        >
          {item.title}
        </Link>
        <Link
          to={to}
          className="text-primary-600 dark:text-primary-400 mt-3 inline-flex items-center gap-1 text-sm font-semibold"
        >
          Leia mais
          <ArrowLongRightIcon className="size-4" />
        </Link>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Compartilhar: destinos vêm dos conectores de Comunicação que permitem
// disparo de mensagem ou postagem (Teams, Slack, WhatsApp, LinkedIn, etc.).

/** Monograma colorido do conector (mesma identidade da página Conectores). */
function ShareTargetLogo({ connector }: { connector: Connector }) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white shadow-sm"
      style={{
        backgroundImage: `linear-gradient(140deg, ${connector.brand}, ${connector.brand}cc)`,
      }}
      aria-hidden="true"
    >
      {connector.initials}
    </span>
  );
}

function ShareModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: FeedItem;
}) {
  const targets = useMemo(shareableConnectors, []);
  const { isConnected, connect } = useConnectorsContext();
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  // Sub-tela de seleção de pessoa para o Chat da plataforma.
  const [view, setView] = useState<"targets" | "people">("targets");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [platformSentTo, setPlatformSentTo] = useState<string | null>(null);

  // Reinicia o feedback ao reabrir.
  useEffect(() => {
    if (open) {
      setSharedIds(new Set());
      setCopied(false);
      setView("targets");
      setPeopleQuery("");
      setPlatformSentTo(null);
    }
  }, [open]);

  const url =
    typeof window !== "undefined" ? window.location.href : "";

  const handleShare = (connector: Connector) => {
    // Sem backend: simula o disparo/postagem e dá feedback visual.
    setSharedIds((prev) => new Set(prev).add(connector.id));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <Transition show={open}>
      <Dialog open={true} onClose={onClose} static className="relative z-100">
        <TransitionChild
          as="div"
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="dark:bg-black/50 fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={DialogPanel}
            enter="ease-out transform-gpu transition duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in transform-gpu transition duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
            className="dark:bg-dark-700 flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
          >
            {/* Cabeçalho */}
            <div className="dark:border-dark-600 flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div className="flex min-w-0 items-start gap-2">
                {view === "people" && (
                  <button
                    type="button"
                    onClick={() => setView("targets")}
                    aria-label="Voltar"
                    className="dark:text-dark-300 dark:hover:bg-dark-600 -ml-1 mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
                  >
                    <ArrowLeftIcon className="size-4.5" />
                  </button>
                )}
                <div className="min-w-0">
                  <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                    {view === "people" ? "Chat da plataforma" : "Compartilhar"}
                  </DialogTitle>
                  <p className="dark:text-dark-300 mt-0.5 truncate text-xs-plus text-gray-500">
                    {view === "people"
                      ? "Selecione a pessoa ou conversa"
                      : item.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="dark:text-dark-300 dark:hover:bg-dark-600 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="size-5" />
              </button>
            </div>

            {view === "people" ? (
              <PlatformPeoplePicker
                query={peopleQuery}
                onQueryChange={setPeopleQuery}
                onSelect={(person) => {
                  setSharedIds((prev) => new Set(prev).add("platform-chat"));
                  setPlatformSentTo(person.nome);
                  setView("targets");
                }}
              />
            ) : (
            <div className="px-5 py-4">
              {/* Copiar link */}
              <button
                type="button"
                onClick={handleCopy}
                className="dark:border-dark-500 dark:hover:bg-dark-600 flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
              >
                <span className="dark:bg-dark-600 dark:text-dark-200 grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
                  {copied ? (
                    <CheckIcon className="size-5 text-emerald-500" />
                  ) : (
                    <LinkIcon className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                    {copied ? "Link copiado!" : "Copiar link"}
                  </span>
                  <span className="dark:text-dark-300 block truncate text-tiny text-gray-400">
                    {url}
                  </span>
                </span>
              </button>

              {/* Destinos de compartilhamento */}
              <p className="dark:text-dark-300 mt-4 mb-2 text-tiny font-semibold tracking-wider text-gray-400 uppercase">
                Compartilhar via
              </p>
              <div className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto px-1">
                {/* Chat da plataforma (beculture) — abre o seletor de pessoa/conversa. */}
                {(() => {
                  const platformShared = sharedIds.has("platform-chat");
                  return (
                    <button
                      type="button"
                      onClick={() => setView("people")}
                      className="dark:hover:bg-dark-600 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="dark:bg-dark-600 grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100">
                        <img
                          src={becultureLogo}
                          alt="beculture"
                          className="size-6 dark:hidden"
                        />
                        <img
                          src={becultureLogoDark}
                          alt="beculture"
                          className="hidden size-6 dark:block"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                          Chat da plataforma
                        </p>
                        <p className="dark:text-dark-300 truncate text-tiny text-gray-400">
                          {platformSentTo
                            ? `Enviado para ${platformSentTo}`
                            : "Selecionar pessoa ou conversa"}
                        </p>
                      </div>
                      {platformShared ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs-plus font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckIcon className="size-4" />
                          Enviado
                        </span>
                      ) : (
                        <span className="text-primary-600 dark:text-primary-400 shrink-0 text-xs-plus font-semibold">
                          Enviar
                        </span>
                      )}
                    </button>
                  );
                })()}

                {targets.map((connector) => {
                  const connected = isConnected(connector.id);
                  const shared = sharedIds.has(connector.id);
                  const kind = connectorShareKind(connector);
                  return (
                    <button
                      key={connector.id}
                      type="button"
                      onClick={() =>
                        connected
                          ? handleShare(connector)
                          : connect(connector.id)
                      }
                      disabled={shared}
                      className="dark:hover:bg-dark-600 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 disabled:cursor-default"
                    >
                      <ShareTargetLogo connector={connector} />
                      <div className="min-w-0 flex-1">
                        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
                          {connector.name}
                        </p>
                        <p className="dark:text-dark-300 text-tiny text-gray-400">
                          {!connected
                            ? "Conecte para compartilhar"
                            : kind === "post"
                              ? "Publicar como postagem"
                              : "Enviar como mensagem"}
                        </p>
                      </div>
                      {!connected ? (
                        <span className="border-primary-200 text-primary-600 dark:border-primary-500/40 dark:text-primary-300 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs-plus font-semibold">
                          <PlusIcon className="size-3.5" />
                          Conectar
                        </span>
                      ) : shared ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs-plus font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckIcon className="size-4" />
                          {kind === "post" ? "Publicado" : "Enviado"}
                        </span>
                      ) : (
                        <span className="text-primary-600 dark:text-primary-400 shrink-0 text-xs-plus font-semibold">
                          {kind === "post" ? "Publicar" : "Enviar"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            )}
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------
// Sub-tela do Chat da plataforma: busca + lista de pessoas/conversas.

function PlatformPeoplePicker({
  query,
  onQueryChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (person: InsightUser) => void;
}) {
  const q = query.trim().toLowerCase();
  const people = q
    ? INSIGHT_USUARIOS.filter(
        (u) =>
          u.nome.toLowerCase().includes(q) ||
          u.cargo.toLowerCase().includes(q),
      )
    : INSIGHT_USUARIOS;

  return (
    <div className="flex max-h-[60vh] min-h-0 flex-col">
      {/* Busca */}
      <div className="dark:border-dark-600 border-b border-gray-100 px-5 py-3">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar pessoa ou conversa…"
            autoFocus
            className="form-input dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white pr-3 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0"
          />
        </div>
      </div>

      {/* Lista */}
      <ul className="min-h-0 flex-1 overflow-y-auto py-2">
        {people.length === 0 ? (
          <li className="dark:text-dark-300 px-5 py-8 text-center text-sm text-gray-400">
            Nenhuma pessoa encontrada.
          </li>
        ) : (
          people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onSelect(person)}
                className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-5 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <img
                  src={person.face}
                  alt={person.nome}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                    {person.nome}
                  </p>
                  <p className="dark:text-dark-300 truncate text-tiny text-gray-400">
                    {person.cargo}
                  </p>
                </div>
                <PaperAirplaneIcon className="dark:text-dark-400 size-4 shrink-0 text-gray-300" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
