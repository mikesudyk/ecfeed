import { useState, useEffect, useCallback, useRef } from "react";
import { CATEGORY_META, type Post, type PostCategory } from "@ecfeed/shared";
import { posts as postsApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { useCompose } from "../lib/compose-context";
import { PostCard } from "../components/PostCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "all" | PostCategory;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "dev", label: "Dev" },
  { key: "ai", label: "AI" },
  { key: "sales_marketing", label: "Sales & Marketing" },
  { key: "design", label: "Design" },
  { key: "other", label: "Other" },
];

// ─── useFeed hook ─────────────────────────────────────────────────────────────

function useFeed(category: Filter) {
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abort controller ref so stale requests don't update state after filter change
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      append ? setLoadingMore(true) : setLoading(true);
      setError(null);

      try {
        const params: Parameters<typeof postsApi.list>[0] = {};
        if (category !== "all") params.category = category;
        if (cursor) params.cursor = cursor;

        const res = await postsApi.list(params);

        if (ctrl.signal.aborted) return;

        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setCursor(res.cursor);
        setHasMore(res.hasMore);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (!ctrl.signal.aborted) {
          append ? setLoadingMore(false) : setLoading(false);
        }
      }
    },
    [category]
  );

  // Re-fetch from scratch when category changes
  useEffect(() => {
    setCursor(null);
    setItems([]);
    fetchPage(null, false);
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && cursor) fetchPage(cursor, true);
  }, [loadingMore, hasMore, cursor, fetchPage]);

  const updatePost = useCallback((id: string, updater: (p: Post) => Post) => {
    setItems((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }, []);

  const prependPost = useCallback((post: Post) => {
    setItems((prev) => [post, ...prev]);
  }, []);

  const removePost = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { items, loading, loadingMore, hasMore, error, loadMore, updatePost, prependPost, removePost, retry: () => fetchPage(null, false) };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <div className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.06] animate-pulse">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3.5 w-28 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
            <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-5 w-10 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          </div>
          {/* Body lines */}
          <div className="space-y-2 mb-3">
            <div className="h-3.5 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3.5 w-5/6 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3.5 w-3/4 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          </div>
          {/* Actions */}
          <div className="flex gap-5">
            <div className="h-3 w-8 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3 w-8 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3 w-6 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const { theme } = useTheme();
  const { openCompose, lastCreatedPost, consumeLastCreatedPost } = useCompose();
  const { user } = useAuth();
  const { items, loading, loadingMore, hasMore, error, loadMore, updatePost, prependPost, removePost, retry } =
    useFeed(activeFilter);

  // Prepend new post when created via compose modal
  useEffect(() => {
    if (!lastCreatedPost) return;
    if (activeFilter === "all" || lastCreatedPost.category === activeFilter) {
      prependPost(lastCreatedPost);
    }
    consumeLastCreatedPost();
  }, [lastCreatedPost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Like/Unlike with optimistic update ────────────────────────────────────

  const handleLike = useCallback(
    async (postId: string) => {
      // Optimistic: flip immediately
      updatePost(postId, (p) => ({ ...p, likedByMe: true, likeCount: p.likeCount + 1 }));
      try {
        await postsApi.like(postId);
      } catch {
        // Revert on failure
        updatePost(postId, (p) => ({ ...p, likedByMe: false, likeCount: Math.max(0, p.likeCount - 1) }));
      }
    },
    [updatePost]
  );

  const handleUnlike = useCallback(
    async (postId: string) => {
      updatePost(postId, (p) => ({ ...p, likedByMe: false, likeCount: Math.max(0, p.likeCount - 1) }));
      try {
        await postsApi.unlike(postId);
      } catch {
        updatePost(postId, (p) => ({ ...p, likedByMe: true, likeCount: p.likeCount + 1 }));
      }
    },
    [updatePost]
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      removePost(postId); // optimistic
      try {
        await postsApi.delete(postId);
      } catch {
        retry(); // revert by re-fetching on failure
      }
    },
    [removePost, retry]
  );

  // ── Filter bar ────────────────────────────────────────────────────────────

  const filterBar = (
    <div className="flex gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] overflow-x-auto scrollbar-none sticky top-0 bg-white dark:bg-[#0a0a0f] z-10">
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.key;
        const cat = f.key !== "all" ? CATEGORY_META[f.key as PostCategory] : null;

        let activeStyle: React.CSSProperties | undefined;
        let activeClass = "";
        if (isActive) {
          if (cat) {
            activeStyle = { backgroundColor: cat.color };
            activeClass = "text-white";
          } else {
            activeClass = theme === "dark"
              ? "bg-gray-100 text-gray-900"
              : "bg-gray-900 text-white";
          }
        }

        return (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              isActive
                ? activeClass
                : "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10"
            }`}
            style={activeStyle}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  // ── Content ───────────────────────────────────────────────────────────────

  let content: React.ReactNode;

  if (loading) {
    content = (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </>
    );
  } else if (error) {
    content = (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm mb-3">{error}</p>
        <button
          onClick={retry}
          className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <div className="py-16 text-center text-gray-400 dark:text-gray-600">
        <p className="text-sm">No posts yet{activeFilter !== "all" ? ` in ${CATEGORY_META[activeFilter].label}` : ""}.</p>
      </div>
    );
  } else {
    content = (
      <>
        {items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onUnlike={handleUnlike}
            onQuote={openCompose}
            onDelete={user ? handleDelete : undefined}
          />
        ))}

        {/* Load more */}
        {hasMore && (
          <div className="py-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-5 py-2 rounded-full text-sm font-semibold bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}

        {/* Inline skeletons while loading more */}
        {loadingMore && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}

        {!hasMore && items.length > 0 && (
          <p className="py-8 text-center text-xs text-gray-300 dark:text-gray-600">
            You're all caught up
          </p>
        )}
      </>
    );
  }

  return (
    <div>
      {filterBar}
      {content}
    </div>
  );
}
