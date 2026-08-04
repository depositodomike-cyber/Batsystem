import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

/** Registro persistido de uma curtida em uma notícia do Feed. */
export interface FeedLike {
  /** Id (slug) da notícia curtida. */
  feedId: string;
  /** Timestamp ISO de quando foi curtida. */
  likedAt: string;
}

export interface LikesContextValue {
  likes: FeedLike[];
  /** Indica se a notícia está curtida pelo usuário. */
  isLiked: (feedId: string) => boolean;
  /** Alterna a curtida e persiste. Retorna o novo estado (true = curtida). */
  toggleLike: (feedId: string) => boolean;
}

export const [LikesContext, useLikesContext] =
  createSafeContext<LikesContextValue>(
    "useLikesContext must be used within LikesProvider",
  );
