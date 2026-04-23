import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MAX_REPLY_DEPTH, MAX_BODY_LENGTH, CATEGORY_META, type Post } from "@ecfeed/shared";
import { posts as postsApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useCompose } from "../lib/compose-context";
import { PostCard } from "../components/PostCard";
import { Avatar, relativeTime, avatarColor, initials, linkifyBody } from "../components/PostCard";

// ─── Tree ─────────────────────────────────────────────────────────────────────

interface ReplyNode {
  post: Post;
  children: ReplyNode[];
}

function buildTree(rootId: string, replies: Post[]): ReplyNode[] {
  const byParent = new Map<string, Post[]>();
  for (const r of replies) {
    const key = r.parentId ?? rootId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(r);
    byParent.set(key, bucket);
  }
  function branch(parentId: string): ReplyNode[] {
    return (byParent.get(parentId) ?? [])
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((post) => ({ post, children: branch(post.id) }));
  }
  return branch(rootId);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Root post skeleton */}
      <div className="px-4 py-5 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2 items-center">
              <div className="h-3.5 w-28 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
              <div className="h-3 w-12 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              <div className="h-5 w-10 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              <div className="h-3.5 w-5/6 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              <div className="h-3.5 w-4/5 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </div>
      {/* Reply skeletons */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.06]"
          style={{ paddingLeft: `${1 + i * 0.5}rem` }}
        >
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-2 items-center">
                <div className="h-3 w-20 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
                <div className="h-3 w-10 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              </div>
              <div className="h-3 w-3/4 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ReplyComposer ────────────────────────────────────────────────────────────

interface ReplyComposerProps {
  rootPostId: string;
  parentId: string;
  parentAuthorName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (reply: Post) => void;
}

function ReplyComposer({
  rootPostId,
  parentId,
  parentAuthorName,
  isOpen,
  onClose,
  onSubmitted,
}: ReplyComposerProps) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [body]);

  // Focus when opening
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setBody("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const reply = await postsApi.reply(rootPostId, {
        body: body.trim(),
        parentId,
      });
      setBody("");
      onSubmitted(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = MAX_BODY_LENGTH - body.length;
  const counterColor =
    remaining < 50 ? "text-red-500" : remaining < 200 ? "text-amber-500" : "text-gray-400 dark:text-gray-500";

  return (
    <div
      className={`overflow-hidden transition-all duration-200 ease-in-out ${
        isOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <form onSubmit={handleSubmit} className="pt-2 pb-1">
        <div className="flex gap-2.5">
          {/* Current user avatar */}
          {user ? (
            user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-1"
              />
            ) : (
              <span
                className={`h-7 w-7 ${avatarColor(user.id)} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-1`}
              >
                {initials(user.displayName)}
              </span>
            )
          ) : (
            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0 mt-1" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
              Replying to{" "}
              <span className="text-brand-500 font-medium">@{parentAuthorName}</span>
            </p>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
              placeholder="Write a reply…"
              rows={2}
              className="w-full resize-none bg-transparent text-base sm:text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none leading-relaxed"
              style={{ minHeight: "48px", maxHeight: "180px", overflowY: "auto" }}
            />
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs tabular-nums ${counterColor}`}>
                {remaining < 200 ? `${remaining} remaining` : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 rounded-full text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!body.trim() || submitting}
                  className="px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {submitting ? "Posting…" : "Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── ReplyCard ────────────────────────────────────────────────────────────────

interface ReplyCardProps {
  post: Post;
  rootPostId: string;
  replyingToId: string | null;
  postsMap: Map<string, Post>;
  onOpenReply: (postId: string) => void;
  onCloseReply: () => void;
  onReplySubmitted: (reply: Post) => void;
  onLike: (postId: string) => void;
  onUnlike: (postId: string) => void;
  onQuote: (post: Post) => void;
  isFlat?: boolean;
}

function ReplyCard({
  post,
  rootPostId,
  replyingToId,
  postsMap,
  onOpenReply,
  onCloseReply,
  onReplySubmitted,
  onLike,
  onUnlike,
  onQuote,
  isFlat = false,
}: ReplyCardProps) {
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isComposerOpen = replyingToId === post.id;

  // For flat replies, prepend @mention of parent
  const parentAuthorName = isFlat && post.parentId
    ? postsMap.get(post.parentId)?.author.displayName ?? null
    : null;

  const TRUNCATE = 280;
  const isTruncated = post.body.length > TRUNCATE;
  const displayBody = isTruncated && !expanded ? post.body.slice(0, TRUNCATE) + "…" : post.body;

  const handleLike = useCallback(() => {
    if (likeAnimating) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 300);
    post.likedByMe ? onUnlike(post.id) : onLike(post.id);
  }, [post.id, post.likedByMe, likeAnimating, onLike, onUnlike]);

  return (
    <div className="py-3">
      <div className="flex gap-2.5">
        <Link to={`/user/${post.author.id}`} className="flex-shrink-0 mt-0.5">
          <Avatar user={post.author} size="sm" />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-1">
            <Link
              to={`/user/${post.author.id}`}
              className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
            >
              {post.author.displayName}
            </Link>
            <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {relativeTime(post.createdAt)}
            </span>
            {/* Show category badge only for depth-1 replies (direct to root) */}
            {post.depth === 1 && (
              <span
                className={`badge-${post.category} inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`}
              >
                {CATEGORY_META[post.category].label}
              </span>
            )}
          </div>

          {/* Body */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {parentAuthorName && (
              <span className="text-brand-500 font-medium mr-1">
                @{parentAuthorName}
              </span>
            )}
            {linkifyBody(displayBody)}
          </p>
          {isTruncated && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-xs font-medium text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            {/* Reply — hidden at max depth */}
            {post.depth < MAX_REPLY_DEPTH && (
              <button
                onClick={() => isComposerOpen ? onCloseReply() : onOpenReply(post.id)}
                className={`flex items-center gap-1 transition-colors group text-xs ${
                  isComposerOpen
                    ? "text-brand-500"
                    : "text-gray-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400"
                }`}
                aria-label="Reply"
              >
                <svg
                  className="h-3.5 w-3.5 group-hover:scale-110 transition-transform"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {post.replyCount > 0 && <span className="tabular-nums">{post.replyCount}</span>}
              </button>
            )}

            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition-colors group text-xs ${
                post.likedByMe
                  ? "text-pink-500"
                  : "text-gray-400 dark:text-gray-500 hover:text-pink-500 dark:hover:text-pink-500"
              }`}
              aria-label={post.likedByMe ? "Unlike" : "Like"}
            >
              <svg
                className={`h-3.5 w-3.5 group-hover:scale-110 transition-transform ${likeAnimating ? "like-bounce" : ""}`}
                viewBox="0 0 24 24"
                fill={post.likedByMe ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likeCount > 0 && <span className="tabular-nums">{post.likeCount}</span>}
            </button>

            {/* Quote */}
            <button
              onClick={() => onQuote(post)}
              className="flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors group text-xs"
              aria-label="Quote reply"
            >
              <svg
                className="h-3.5 w-3.5 group-hover:scale-110 transition-transform"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
          </div>

          {/* Inline reply composer */}
          <ReplyComposer
            rootPostId={rootPostId}
            parentId={post.id}
            parentAuthorName={post.author.displayName}
            isOpen={isComposerOpen}
            onClose={onCloseReply}
            onSubmitted={onReplySubmitted}
          />
        </div>
      </div>
    </div>
  );
}

// ─── ReplyBranch (recursive) ──────────────────────────────────────────────────

interface ReplyBranchProps {
  nodes: ReplyNode[];
  rootPostId: string;
  replyingToId: string | null;
  postsMap: Map<string, Post>;
  onOpenReply: (postId: string) => void;
  onCloseReply: () => void;
  onReplySubmitted: (reply: Post) => void;
  onLike: (postId: string) => void;
  onUnlike: (postId: string) => void;
  onQuote: (post: Post) => void;
  isNested?: boolean;
}

function ReplyBranch({
  nodes,
  rootPostId,
  replyingToId,
  postsMap,
  onOpenReply,
  onCloseReply,
  onReplySubmitted,
  onLike,
  onUnlike,
  onQuote,
  isNested = false,
}: ReplyBranchProps) {
  if (nodes.length === 0) return null;

  const sharedProps = {
    rootPostId,
    replyingToId,
    postsMap,
    onOpenReply,
    onCloseReply,
    onReplySubmitted,
    onLike,
    onUnlike,
    onQuote,
  };

  const content = nodes.map((node) => {
    const atMaxDepth = node.post.depth >= MAX_REPLY_DEPTH;

    return (
      <div
        key={node.post.id}
        className="border-b border-gray-50 dark:border-white/[0.04] last:border-0"
      >
        <ReplyCard post={node.post} isFlat={atMaxDepth} {...sharedProps} />

        {/* Children: at max depth, render flat (no further indent) */}
        {node.children.length > 0 && (
          <ReplyBranch
            nodes={node.children}
            isNested={!atMaxDepth}
            {...sharedProps}
          />
        )}
      </div>
    );
  });

  if (isNested) {
    return (
      <div className="ml-4 pl-3 border-l-2 border-gray-100 dark:border-white/[0.06]">
        {content}
      </div>
    );
  }

  return <>{content}</>;
}

// ─── ThreadPage ───────────────────────────────────────────────────────────────

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rootPost, setRootPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single open composer at a time; value is the post ID being replied to
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  // Fetch thread
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    postsApi
      .get(id)
      .then(({ post, replies }) => {
        setRootPost(post);
        setReplies(replies);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const updatePost = useCallback((postId: string, updater: (p: Post) => Post) => {
    setRootPost((prev) => (prev?.id === postId ? updater(prev) : prev));
    setReplies((prev) => prev.map((r) => (r.id === postId ? updater(r) : r)));
  }, []);

  const handleLike = useCallback(
    async (postId: string) => {
      updatePost(postId, (p) => ({ ...p, likedByMe: true, likeCount: p.likeCount + 1 }));
      try {
        await postsApi.like(postId);
      } catch {
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

  const handleReplySubmitted = useCallback((reply: Post) => {
    setReplies((prev) => [...prev, reply]);
    // Bump replyCount on the parent
    updatePost(reply.parentId!, (p) => ({ ...p, replyCount: p.replyCount + 1 }));
    setReplyingToId(null);
  }, [updatePost]);

  const { openCompose } = useCompose();

  // ── Derived ──────────────────────────────────────────────────────────────

  const postsMap = new Map<string, Post>();
  if (rootPost) postsMap.set(rootPost.id, rootPost);
  for (const r of replies) postsMap.set(r.id, r);

  const tree = rootPost ? buildTree(rootPost.id, replies) : [];

  const replyBranchProps = {
    rootPostId: id!,
    replyingToId,
    postsMap,
    onOpenReply: setReplyingToId,
    onCloseReply: () => setReplyingToId(null),
    onReplySubmitted: handleReplySubmitted,
    onLike: handleLike,
    onUnlike: handleUnlike,
    onQuote: openCompose,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <ThreadSkeleton />;

  if (error) {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm mb-3">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  if (!rootPost) return null;

  return (
    <div>
      {/* Back nav */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Thread</span>
      </div>

      {/* Root post */}
      <PostCard
        post={rootPost}
        onLike={handleLike}
        onUnlike={handleUnlike}
        onReply={(post) => setReplyingToId(post.id)}
        onQuote={openCompose}
      />

      {/* Root-level reply composer (triggered from PostCard's reply button) */}
      <div className="px-4 border-b border-gray-100 dark:border-white/[0.06]">
        <ReplyComposer
          rootPostId={rootPost.id}
          parentId={rootPost.id}
          parentAuthorName={rootPost.author.displayName}
          isOpen={replyingToId === rootPost.id}
          onClose={() => setReplyingToId(null)}
          onSubmitted={handleReplySubmitted}
        />
      </div>

      {/* Reply count header */}
      {replies.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </p>
        </div>
      )}

      {/* Threaded replies */}
      {tree.length > 0 ? (
        <div className="px-4 divide-y divide-gray-50 dark:divide-white/[0.04]">
          <ReplyBranch nodes={tree} {...replyBranchProps} />
        </div>
      ) : (
        !loading && (
          <div className="py-12 text-center text-gray-400 dark:text-gray-600">
            <p className="text-sm">No replies yet. Be the first to reply.</p>
          </div>
        )
      )}
    </div>
  );
}
