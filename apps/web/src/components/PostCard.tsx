import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { CATEGORY_META, type Post, type LinkPreview } from "@ecfeed/shared";
import { useAuth } from "../lib/auth-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const date = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === new Date().getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", opts);
}

export const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-indigo-500",
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const TRUNCATE_AT = 280;

const URL_RE = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)'"\]]/g;

export function linkifyBody(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-500 hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export interface AvatarProps {
  user: Post["author"];
  size?: "sm" | "md";
}

export function Avatar({ user, size = "md" }: AvatarProps) {
  const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <span
      className={`${dim} ${avatarColor(user.id)} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
    >
      {initials(user.displayName)}
    </span>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Post["category"] }) {
  return (
    <span className={`badge-${category} inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`}>
      {CATEGORY_META[category].label}
    </span>
  );
}

// ─── Link Preview Card ────────────────────────────────────────────────────────

function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt=""
          className="w-24 h-24 object-cover flex-shrink-0"
        />
      )}
      <div className="flex flex-col justify-center gap-1 px-3 py-2 min-w-0">
        {preview.siteName && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">
            {preview.faviconUrl && (
              <img src={preview.faviconUrl} alt="" className="h-3 w-3" />
            )}
            {preview.siteName}
          </span>
        )}
        {preview.title && (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ─── Quoted Post Card ─────────────────────────────────────────────────────────

function QuotedPostCard({ post }: { post: Post }) {
  return (
    <Link
      to={`/post/${post.id}`}
      className="mt-3 block rounded-xl border border-gray-200 dark:border-white/[0.08] px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar user={post.author} size="sm" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {post.author.displayName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {relativeTime(post.createdAt)}
        </span>
        <CategoryBadge category={post.category} />
      </div>
      {post.title && (
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1 line-clamp-1">
          {post.title}
        </p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
        {post.body}
      </p>
    </Link>
  );
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
        aria-label="Close image"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

// ─── Post Menu (owner-only "..." dropdown) ────────────────────────────────────

function PostMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-md text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        aria-label="Post options"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#18181f] shadow-lg py-1">
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Delete post
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

export interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onUnlike?: (postId: string) => void;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, onLike, onUnlike, onReply, onQuote, onDelete }: PostCardProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const isOwner = !!user && user.id === post.author.id;

  const isTruncated = post.body.length > TRUNCATE_AT;
  const displayBody =
    isTruncated && !expanded ? post.body.slice(0, TRUNCATE_AT) + "…" : post.body;

  const handleLike = useCallback(() => {
    if (likeAnimating) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 300);
    if (post.likedByMe) {
      onUnlike?.(post.id);
    } else {
      onLike?.(post.id);
    }
  }, [post.id, post.likedByMe, likeAnimating, onLike, onUnlike]);

  return (
    <article className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex gap-3">
        {/* Avatar column */}
        <Link to={`/user/${post.author.id}`} className="flex-shrink-0 mt-0.5">
          <Avatar user={post.author} />
        </Link>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-x-2 gap-y-1 mb-1 flex-wrap">
            <Link
              to={`/user/${post.author.id}`}
              className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
            >
              {post.author.displayName}
            </Link>
            {post.author.roleTitle && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[12rem]">
                {post.author.roleTitle}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
            <Link
              to={`/post/${post.id}`}
              className="text-xs text-gray-400 dark:text-gray-500 hover:underline"
            >
              {relativeTime(post.createdAt)}
            </Link>
            <CategoryBadge category={post.category} />
            {isOwner && onDelete && (
              <PostMenu onDelete={() => onDelete(post.id)} />
            )}
          </div>

          {/* Optional title */}
          {post.title && (
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 leading-snug">
              {post.title}
            </p>
          )}

          {/* Body */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {linkifyBody(displayBody)}
          </p>
          {isTruncated && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}

          {/* Post image — click to expand */}
          {post.imageUrl && (
            <>
              <button
                type="button"
                onClick={() => setLightbox(true)}
                className="mt-3 block w-full rounded-xl overflow-hidden border border-gray-100 dark:border-white/[0.06] cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="View full image"
              >
                <img
                  src={post.imageUrl}
                  alt=""
                  className="max-h-80 w-full object-cover"
                />
              </button>
              {lightbox && (
                <ImageLightbox src={post.imageUrl} onClose={() => setLightbox(false)} />
              )}
            </>
          )}

          {/* Link preview — or bare link if preview unavailable */}
          {post.linkPreview ? (
            <LinkPreviewCard preview={post.linkPreview} />
          ) : post.url && !post.body.includes(post.url) ? (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-brand-500 hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {post.url}
            </a>
          ) : null}

          {/* Quoted post */}
          {post.quotedPost && <QuotedPostCard post={post.quotedPost} />}

          {/* Action bar */}
          <div className="flex items-center gap-5 mt-3">
            {/* Reply */}
            <button
              onClick={() => onReply?.(post)}
              className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors group"
              aria-label={`${post.replyCount} replies`}
            >
              <svg
                className="h-4 w-4 group-hover:scale-110 transition-transform"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {post.replyCount > 0 && (
                <span className="text-xs tabular-nums">{post.replyCount}</span>
              )}
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors group ${
                post.likedByMe
                  ? "text-pink-500"
                  : "text-gray-400 dark:text-gray-500 hover:text-pink-500 dark:hover:text-pink-500"
              }`}
              aria-label={post.likedByMe ? "Unlike" : "Like"}
            >
              <svg
                className={`h-4 w-4 transition-transform group-hover:scale-110 ${likeAnimating ? "like-bounce" : ""}`}
                viewBox="0 0 24 24"
                fill={post.likedByMe ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likeCount > 0 && (
                <span className="text-xs tabular-nums">{post.likeCount}</span>
              )}
            </button>

            {/* Quote */}
            <button
              onClick={() => onQuote?.(post)}
              className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors group"
              aria-label="Quote post"
            >
              <svg
                className="h-4 w-4 group-hover:scale-110 transition-transform"
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
        </div>
      </div>
    </article>
  );
}
