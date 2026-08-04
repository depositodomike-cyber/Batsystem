import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

/** Comentário (ou resposta) persistido em uma notícia do Feed. */
export interface FeedComment {
  id: string;
  /** Id (slug) da notícia comentada. */
  feedId: string;
  /** Quando preenchido, é uma resposta ao comentário de id `parentId`. */
  parentId?: string;
  /** Nome de quem comentou. */
  author: string;
  /** Avatar de quem comentou. */
  avatarUrl: string;
  /** Texto do comentário (pode conter menções no formato "@Nome"). */
  text: string;
  /** Timestamp ISO de criação. */
  createdAt: string;
  /** Total de curtidas. */
  likes: number;
  /** Se o usuário atual curtiu este comentário. */
  likedByMe: boolean;
}

export type NewComment = {
  feedId: string;
  text: string;
  author: string;
  avatarUrl: string;
  /** Define a resposta a um comentário existente. */
  parentId?: string;
};

export interface CommentsContextValue {
  comments: FeedComment[];
  /** Comentários de topo (não-respostas) de uma notícia, mais recentes primeiro. */
  topLevelByFeed: (feedId: string) => FeedComment[];
  /** Respostas de um comentário, mais antigas primeiro (ordem da thread). */
  repliesOf: (commentId: string) => FeedComment[];
  /** Total de comentários + respostas de uma notícia. */
  commentCount: (feedId: string) => number;
  /** Adiciona um comentário ou resposta e persiste. */
  addComment: (data: NewComment) => FeedComment;
  /** Remove um comentário (e suas respostas, em cascata). */
  removeComment: (id: string) => void;
  /** Alterna a curtida de um comentário e persiste. */
  toggleCommentLike: (id: string) => void;
}

export const [CommentsContext, useCommentsContext] =
  createSafeContext<CommentsContextValue>(
    "useCommentsContext must be used within CommentsProvider",
  );
