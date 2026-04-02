import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  MAX_BIO_LENGTH,
  MAX_ROLE_TITLE_LENGTH,
  type Post,
  type UserProfile,
  type User,
} from "@ecfeed/shared";
import { users as usersApi, posts as postsApi } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useCompose } from "../lib/compose-context";
import { PostCard } from "../components/PostCard";
import { avatarColor, initials } from "../components/PostCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DISPLAY_NAME_LENGTH = 100;
type TabKey = "posts" | "replies" | "likes";
const TABS: { key: TabKey; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "replies", label: "Replies" },
  { key: "likes", label: "Likes" },
];

// ─── Profile header avatar (larger than PostCard's Avatar) ────────────────────

function ProfileAvatar({ user }: { user: UserProfile }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="h-16 w-16 rounded-full object-cover ring-4 ring-white dark:ring-[#0a0a0f] flex-shrink-0"
      />
    );
  }
  return (
    <span
      className={`h-16 w-16 ${avatarColor(user.id)} rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white dark:ring-[#0a0a0f] flex-shrink-0`}
    >
      {initials(user.displayName)}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-5 w-40 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
            <div className="h-3.5 w-28 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-white/[0.05] mt-2" />
            <div className="h-3 w-3/4 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="flex gap-4 pt-1">
              <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              <div className="h-3 w-20 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-white/[0.06] px-4">
        {[80, 64, 52].map((w, i) => (
          <div key={i} className="py-3 mr-6">
            <div className={`h-3.5 w-${w === 80 ? "20" : w === 64 ? "16" : "12"} rounded-full bg-gray-100 dark:bg-white/[0.05]`} />
          </div>
        ))}
      </div>
      {/* Post skeletons */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-3.5 w-28 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
                <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]" />
              <div className="h-3 w-4/5 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostCardSkeleton() {
  return (
    <div className="px-4 py-4 border-b border-gray-100 dark:border-white/[0.06] animate-pulse">
      <div className="flex gap-3">
        <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/[0.08] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 items-center">
            <div className="h-3.5 w-28 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
            <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          <div className="h-3 w-4/5 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          <div className="flex gap-5 pt-1">
            <div className="h-3 w-8 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
            <div className="h-3 w-8 rounded-full bg-gray-100 dark:bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (user: User) => void;
}

function EditProfileModal({ profile, isOpen, onClose, onSaved }: EditProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // Form state — synced from profile on each open
  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setDisplayName(profile.displayName);
      setRoleTitle(profile.roleTitle ?? "");
      setBio(profile.bio ?? "");
      setError(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]); // profile captured from closure on open

  const bioRef = useRef<HTMLTextAreaElement>(null);
  // Auto-resize bio textarea
  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [bio]);

  const bioRemaining = MAX_BIO_LENGTH - bio.length;
  const bioCounterColor =
    bioRemaining < 20 ? "text-red-500" : bioRemaining < 60 ? "text-amber-500" : "text-gray-400 dark:text-gray-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await usersApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        roleTitle: roleTitle.trim() || undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
    >
      <div
        className={`w-full sm:max-w-md bg-white dark:bg-[#111118] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-6 sm:translate-y-0"
        }`}
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-5 flex-1">
            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Display name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, MAX_DISPLAY_NAME_LENGTH))}
                placeholder="Your name"
                className="w-full bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border border-gray-200 dark:border-white/[0.06] focus:border-brand-500 dark:focus:border-brand-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Role title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Role title <span className="text-gray-400 font-normal">— optional</span>
              </label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value.slice(0, MAX_ROLE_TITLE_LENGTH))}
                placeholder="e.g. Senior Engineer, Head of Design…"
                className="w-full bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border border-gray-200 dark:border-white/[0.06] focus:border-brand-500 dark:focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Bio <span className="text-gray-400 font-normal">— optional</span>
              </label>
              <textarea
                ref={bioRef}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                placeholder="Tell the team a bit about yourself…"
                rows={3}
                className="w-full resize-none bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border border-gray-200 dark:border-white/[0.06] focus:border-brand-500 dark:focus:border-brand-500 transition-colors leading-relaxed"
                style={{ minHeight: "72px", maxHeight: "160px", overflowY: "auto" }}
              />
              <div className={`text-xs text-right mt-1 tabular-nums ${bioCounterColor}`}>
                {bioRemaining < MAX_BIO_LENGTH ? `${bioRemaining} remaining` : ""}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!displayName.trim() || submitting}
              className="px-5 py-2 rounded-full text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── useTabData hook ──────────────────────────────────────────────────────────

function useTabData(userId: string | undefined, tab: TabKey) {
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cur: string | null, append: boolean) => {
      if (!userId) return;
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);
      try {
        const params = cur ? { cursor: cur } : {};
        const res =
          tab === "posts"
            ? await usersApi.posts(userId, params)
            : tab === "replies"
            ? await usersApi.replies(userId, params)
            : await usersApi.likes(userId, params);
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setCursor(res.cursor);
        setHasMore(res.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [userId, tab]
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    fetchPage(null, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && cursor) fetchPage(cursor, true);
  }, [loadingMore, hasMore, cursor, fetchPage]);

  const updatePost = useCallback((id: string, updater: (p: Post) => Post) => {
    setItems((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }, []);

  return { items, loading, loadingMore, hasMore, error, loadMore, updatePost, retry: () => fetchPage(null, false) };
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser, updateUser } = useAuth();
  const { openCompose } = useCompose();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [editOpen, setEditOpen] = useState(false);

  // ── Fetch profile ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    setProfileLoading(true);
    setProfileError(null);
    usersApi
      .profile(id)
      .then(setProfile)
      .catch((err: unknown) => {
        setProfileError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => setProfileLoading(false));
  }, [id]);

  // ── Tab data ─────────────────────────────────────────────────────────────

  const { items, loading: tabLoading, loadingMore, hasMore, error: tabError, loadMore, updatePost, retry } =
    useTabData(id, activeTab);

  // ── Like handlers ────────────────────────────────────────────────────────

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

  // ── Edit saved ───────────────────────────────────────────────────────────

  const handleProfileSaved = useCallback(
    (updated: User) => {
      setProfile((prev) =>
        prev ? { ...prev, ...updated } : null
      );
      // Sync the auth header (display name initials)
      if (authUser?.id === updated.id) updateUser(updated);
    },
    [authUser, updateUser]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const isOwnProfile = !!authUser && authUser.id === id;

  if (profileLoading) return <ProfileSkeleton />;

  if (profileError || !profile) {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm">{profileError ?? "User not found"}</p>
        <Link
          to="/"
          className="mt-3 inline-block px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Back to feed
        </Link>
      </div>
    );
  }

  // Tab content
  let tabContent: React.ReactNode;
  const emptyMessages: Record<TabKey, string> = {
    posts: "No posts yet.",
    replies: "No replies yet.",
    likes: "No liked posts yet.",
  };

  if (tabLoading) {
    tabContent = (
      <>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </>
    );
  } else if (tabError) {
    tabContent = (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm mb-3">{tabError}</p>
        <button
          onClick={retry}
          className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  } else if (items.length === 0) {
    tabContent = (
      <div className="py-12 text-center text-gray-400 dark:text-gray-600">
        <p className="text-sm">{emptyMessages[activeTab]}</p>
      </div>
    );
  } else {
    tabContent = (
      <>
        {items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onUnlike={handleUnlike}
            onQuote={openCompose}
          />
        ))}
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
        {loadingMore && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}
        {!hasMore && items.length > 0 && (
          <p className="py-8 text-center text-xs text-gray-300 dark:text-gray-600">
            {activeTab === "likes" ? "All likes shown" : "All caught up"}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {/* ── Profile header ── */}
      <div className="px-4 pt-6 pb-5 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-start gap-4">
          <ProfileAvatar user={profile} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight truncate">
                  {profile.displayName}
                </h1>
                {profile.roleTitle && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {profile.roleTitle}
                  </p>
                )}
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/[0.1] hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit profile
                </button>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2.5 leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {profile.postCount.toLocaleString()}
                </span>{" "}
                {profile.postCount === 1 ? "post" : "posts"}
              </span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {profile.likesReceived.toLocaleString()}
                </span>{" "}
                {profile.likesReceived === 1 ? "like" : "likes"} received
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-gray-100 dark:border-white/[0.06] sticky top-0 bg-white dark:bg-[#0a0a0f] z-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === tab.key
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tabContent}

      {/* ── Edit profile modal ── */}
      {isOwnProfile && (
        <EditProfileModal
          profile={profile}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}
    </>
  );
}
