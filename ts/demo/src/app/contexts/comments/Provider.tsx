import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
  CommentsContext,
  type CommentsContextValue,
  type FeedComment,
  type NewComment,
} from "./context";

// ----------------------------------------------------------------------

const STORAGE_KEY = "ceo-os:feed-comments";

function createId(): string {
  return `cmt_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function loadComments(): FeedComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.feedId === "string" && typeof c.text === "string")
      .map(
        (c): FeedComment => ({
          id: String(c?.id ?? createId()),
          feedId: String(c.feedId),
          parentId: c?.parentId ? String(c.parentId) : undefined,
          author: String(c?.author ?? "Você"),
          avatarUrl: String(c?.avatarUrl ?? "/images/avatar/avatar-12.jpg"),
          text: String(c.text),
          createdAt: c?.createdAt ? String(c.createdAt) : new Date().toISOString(),
          likes: Number.isFinite(c?.likes) ? Number(c.likes) : 0,
          likedByMe: Boolean(c?.likedByMe),
        }),
      );
  } catch {
    return [];
  }
}

export function CommentsProvider({ children }: { children: ReactNode }) {
  const [comments, setComments] = useState<FeedComment[]>(loadComments);

  // Persiste no "banco" (localStorage) a cada alteração.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    } catch {
      /* ignora falhas de persistência (ex.: modo privado) */
    }
  }, [comments]);

  const topLevelByFeed = useCallback(
    (feedId: string) =>
      comments
        .filter((c) => c.feedId === feedId && !c.parentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [comments],
  );

  const repliesOf = useCallback(
    (commentId: string) =>
      comments
        .filter((c) => c.parentId === commentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments],
  );

  const commentCount = useCallback(
    (feedId: string) => comments.filter((c) => c.feedId === feedId).length,
    [comments],
  );

  const addComment = useCallback((data: NewComment) => {
    const comment: FeedComment = {
      id: createId(),
      feedId: data.feedId,
      parentId: data.parentId,
      author: data.author,
      avatarUrl: data.avatarUrl,
      text: data.text,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments((prev) => [comment, ...prev]);
    return comment;
  }, []);

  const removeComment = useCallback((id: string) => {
    // Remove o comentário e, em cascata, suas respostas.
    setComments((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));
  }, []);

  const toggleCommentLike = useCallback((id: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              likedByMe: !c.likedByMe,
              likes: c.likedByMe ? Math.max(0, c.likes - 1) : c.likes + 1,
            }
          : c,
      ),
    );
  }, []);

  const value = useMemo<CommentsContextValue>(
    () => ({
      comments,
      topLevelByFeed,
      repliesOf,
      commentCount,
      addComment,
      removeComment,
      toggleCommentLike,
    }),
    [
      comments,
      topLevelByFeed,
      repliesOf,
      commentCount,
      addComment,
      removeComment,
      toggleCommentLike,
    ],
  );

  return <CommentsContext value={value}>{children}</CommentsContext>;
}
