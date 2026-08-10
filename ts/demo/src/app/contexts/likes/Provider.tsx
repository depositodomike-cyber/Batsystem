import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import {
  LikesContext,
  type LikesContextValue,
  type FeedLike,
} from "./context";

// ----------------------------------------------------------------------

const STORAGE_BASE = "ceo-os:feed-likes";

function loadLikes(): FeedLike[] {
  try {
    const raw = lerComMigracao(STORAGE_BASE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.feedId === "string")
      .map(
        (l): FeedLike => ({
          feedId: String(l.feedId),
          likedAt: l?.likedAt ? String(l.likedAt) : new Date().toISOString(),
        }),
      );
  } catch {
    return [];
  }
}

export function LikesProvider({ children }: { children: ReactNode }) {
  const [likes, setLikes] = useState<FeedLike[]>(loadLikes);

  // Persiste no "banco" (localStorage) a cada alteração.
  useEffect(() => {
    try {
      localStorage.setItem(chaveConta(STORAGE_BASE), JSON.stringify(likes));
    } catch {
      /* ignora falhas de persistência (ex.: modo privado) */
    }
  }, [likes]);

  const isLiked = useCallback(
    (feedId: string) => likes.some((l) => l.feedId === feedId),
    [likes],
  );

  const toggleLike = useCallback((feedId: string) => {
    let nowLiked = false;
    setLikes((prev) => {
      const exists = prev.some((l) => l.feedId === feedId);
      if (exists) {
        nowLiked = false;
        return prev.filter((l) => l.feedId !== feedId);
      }
      nowLiked = true;
      return [{ feedId, likedAt: new Date().toISOString() }, ...prev];
    });
    return nowLiked;
  }, []);

  const value = useMemo<LikesContextValue>(
    () => ({ likes, isLiked, toggleLike }),
    [likes, isLiked, toggleLike],
  );

  return <LikesContext value={value}>{children}</LikesContext>;
}
