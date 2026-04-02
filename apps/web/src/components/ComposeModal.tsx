import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_META, POST_CATEGORIES, MAX_BODY_LENGTH, MAX_TITLE_LENGTH,
  MAX_IMAGE_SIZE_MB, ACCEPTED_IMAGE_TYPES,
  type Post, type PostCategory, type LinkPreviewResponse,
} from "@ecfeed/shared";
import { posts as postsApi, uploads } from "../lib/api";
import { Avatar, relativeTime } from "./PostCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/.+/i;

// ─── Link Preview (inline, uses LinkPreviewResponse shape) ────────────────────

function PreviewCard({
  url,
  preview,
  onDismiss,
}: {
  url: string;
  preview: LinkPreviewResponse;
  onDismiss: () => void;
}) {
  return (
    <div className="relative mt-1 flex rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden bg-gray-50 dark:bg-white/[0.03]">
      {preview.imageUrl && (
        <img src={preview.imageUrl} alt="" className="w-20 h-20 object-cover flex-shrink-0" />
      )}
      <div className="flex flex-col justify-center gap-1 px-3 py-2 min-w-0 flex-1">
        {preview.siteName && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">
            {preview.faviconUrl && <img src={preview.faviconUrl} alt="" className="h-3 w-3" />}
            {preview.siteName}
          </span>
        )}
        {preview.title && (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 leading-snug">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">
            {preview.description}
          </p>
        )}
        {!preview.title && !preview.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{url}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-1.5 right-1.5 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        aria-label="Remove preview"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Quoted Post Embed ────────────────────────────────────────────────────────

function QuotedPostEmbed({ post }: { post: Post }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] pointer-events-none select-none">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Avatar user={post.author} size="sm" />
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {post.author.displayName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {relativeTime(post.createdAt)}
        </span>
        <span
          className={`badge-${post.category} inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`}
        >
          {CATEGORY_META[post.category].label}
        </span>
      </div>
      {post.title && (
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1 line-clamp-1">
          {post.title}
        </p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
        {post.body}
      </p>
    </div>
  );
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────

type UploadStatus = "idle" | "dragging" | "uploading" | "done" | "error";

interface ImageUploadZoneProps {
  onUploaded: (publicUrl: string) => void;
  onRemoved: () => void;
  onUploadingChange: (v: boolean) => void;
}

function ImageUploadZone({ onUploaded, onRemoved, onUploadingChange }: ImageUploadZoneProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL and abort any in-flight XHR on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      xhrRef.current?.abort();
    };
  }, []);

  const startUpload = useCallback(async (file: File) => {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setStatus("error");
      setErrorMsg(`Unsupported type. Use JPEG, PNG, WebP, or GIF.`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setStatus("error");
      setErrorMsg(`File too large. Max ${MAX_IMAGE_SIZE_MB} MB.`);
      return;
    }

    // Show local preview immediately — no waiting for the upload
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objUrl = URL.createObjectURL(file);
    objectUrlRef.current = objUrl;
    setPreviewSrc(objUrl);
    setFileName(file.name);
    setStatus("uploading");
    setProgress(0);
    onUploadingChange(true);

    try {
      const { uploadUrl, publicUrl } = await uploads.presign(file.name, file.type);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`))
        );
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("aborted")));
        xhr.send(file);
      });

      setStatus("done");
      setProgress(100);
      onUploaded(publicUrl);
    } catch (err) {
      if (err instanceof Error && err.message === "aborted") return;
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
      setPreviewSrc(null);
    } finally {
      onUploadingChange(false);
      xhrRef.current = null;
    }
  }, [onUploaded, onUploadingChange]);

  const handleRemove = () => {
    xhrRef.current?.abort();
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setPreviewSrc(null);
    setFileName(null);
    setStatus("idle");
    setErrorMsg(null);
    setProgress(0);
    onRemoved();
  };

  const handleFiles = (files: FileList | null) => { if (files?.[0]) startUpload(files[0]); };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (status === "idle") setStatus("dragging");
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (--dragCounter.current === 0 && status === "dragging") setStatus("idle");
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    handleFiles(e.dataTransfer.files);
  };

  // ── uploading / done ──────────────────────────────────────────────────────
  if (status === "uploading" || status === "done") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] p-2.5">
        <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-white/[0.08]">
          {previewSrc && <img src={previewSrc} alt="" className="h-full w-full object-cover" />}
          {status === "uploading" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-xs font-bold tabular-nums">{progress}%</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{fileName}</p>
          {status === "uploading" ? (
            <>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Uploading…</p>
            </>
          ) : (
            <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Ready
            </p>
          )}
        </div>
        {status === "done" && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
            aria-label="Remove image"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2.5 flex items-center gap-3">
        <svg className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
        </svg>
        <p className="text-xs text-red-600 dark:text-red-400 flex-1">{errorMsg}</p>
        <button
          type="button"
          onClick={() => { setStatus("idle"); setErrorMsg(null); fileInputRef.current?.click(); }}
          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex-shrink-0"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── idle / dragging ───────────────────────────────────────────────────────
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      aria-label="Upload image"
      className={`rounded-xl border-2 border-dashed cursor-pointer transition-all py-5 flex flex-col items-center justify-center gap-1.5 select-none ${
        status === "dragging"
          ? "border-brand-500 bg-brand-500/5 scale-[1.01]"
          : "border-gray-200 dark:border-white/[0.1] hover:border-brand-500/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      }`}
    >
      <svg
        className={`h-6 w-6 transition-colors ${status === "dragging" ? "text-brand-500" : "text-gray-300 dark:text-gray-600"}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <p className={`text-xs font-medium transition-colors ${status === "dragging" ? "text-brand-500" : "text-gray-400 dark:text-gray-500"}`}>
        {status === "dragging" ? "Drop to upload" : "Drop an image or click to browse"}
      </p>
      <p className="text-xs text-gray-300 dark:text-gray-700">
        JPEG, PNG, WebP, GIF · max {MAX_IMAGE_SIZE_MB} MB
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        // Reset value so the same file can be re-selected after removal
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
    </div>
  );
}

// ─── Category Picker ──────────────────────────────────────────────────────────

function CategoryPicker({
  value,
  onChange,
}: {
  value: PostCategory | null;
  onChange: (cat: PostCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {POST_CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const selected = value === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selected ? "text-white shadow-sm" : "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10"
            }`}
            style={selected ? { backgroundColor: meta.color } : undefined}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────

export interface ComposeModalProps {
  isOpen: boolean;
  quotedPost: Post | null;
  onClose: () => void;
  onCreated: (post: Post) => void;
}

export function ComposeModal({ isOpen, quotedPost, onClose, onCreated }: ComposeModalProps) {
  // ── Animation state ──────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Double-rAF ensures the initial (invisible) state is painted before
      // we flip visible, giving CSS transitions something to animate from.
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Scroll lock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // ── Escape key ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Form state ───────────────────────────────────────────────────────────
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<PostCategory | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Incrementing this key remounts ImageUploadZone, resetting its internal state
  const [uploadKey, setUploadKey] = useState(0);

  // ── Link preview ─────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<LinkPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);

  useEffect(() => {
    if (!url || !URL_RE.test(url) || previewDismissed) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await uploads.linkPreview(url);
        setPreview(data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [url, previewDismissed]);

  // Reset dismissed flag when URL changes
  useEffect(() => { setPreviewDismissed(false); }, [url]);

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 300) + "px";
  }, [body]);

  // ── Focus first field on open ────────────────────────────────────────────
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => bodyRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Merge refs
  const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    (bodyRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const post = await postsApi.create({
        body: body.trim(),
        ...(title.trim() && { title: title.trim() }),
        ...(url.trim() && { url: url.trim() }),
        ...(imageUrl && { imageUrl }),
        category,
        ...(quotedPost && { quotedPostId: quotedPost.id }),
      });
      resetForm();
      onCreated(post);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset on close ───────────────────────────────────────────────────────
  const resetForm = () => {
    setBody("");
    setTitle("");
    setUrl("");
    setCategory(null);
    setPreview(null);
    setPreviewDismissed(false);
    setSubmitError(null);
    setImageUrl(null);
    setIsUploading(false);
    setUploadKey((k) => k + 1);
  };

  // Reset when modal opens; pre-fill category when quoting
  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      resetForm();
      if (quotedPost) setCategory(quotedPost.category);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]); // quotedPost captured from current closure on open

  // ── Char counter color ───────────────────────────────────────────────────
  const remaining = MAX_BODY_LENGTH - body.length;
  const counterColor =
    remaining < 50
      ? "text-red-500"
      : remaining < 200
      ? "text-amber-500"
      : "text-gray-400 dark:text-gray-500";

  const canSubmit = body.trim().length > 0 && category !== null && !submitting && !isUploading;

  if (!mounted) return null;

  return createPortal(
    // Backdrop
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-label="Compose new post"
    >
      {/* Modal card */}
      <div
        className={`w-full sm:max-w-lg bg-white dark:bg-[#111118] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-6 sm:translate-y-0"
        }`}
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {quotedPost ? "Quote Post" : "New Post"}
          </h2>
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

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-4 px-5 py-4 flex-1">
            {/* Quoted post embed */}
            {quotedPost && (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  Quoting
                </p>
                <QuotedPostEmbed post={quotedPost} />
              </div>
            )}

            {/* Body */}
            <div>
              <textarea
                ref={setTextareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
                placeholder={quotedPost ? "Add your thoughts…" : "What's on your mind?"}
                rows={4}
                className="w-full resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none leading-relaxed"
                style={{ minHeight: "96px", maxHeight: "300px", overflowY: "auto" }}
              />
              <div className={`text-xs text-right mt-1 tabular-nums ${counterColor}`}>
                {remaining.toLocaleString()} / {MAX_BODY_LENGTH.toLocaleString()}
              </div>
            </div>

            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder="Title — optional"
                className="w-full bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border border-gray-200 dark:border-white/[0.06] focus:border-brand-500 dark:focus:border-brand-500 transition-colors"
              />
            </div>

            {/* URL + Link preview */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  {previewLoading ? (
                    <svg className="h-4 w-4 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https:// — optional link"
                  className="w-full bg-gray-50 dark:bg-white/[0.04] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none border border-gray-200 dark:border-white/[0.06] focus:border-brand-500 dark:focus:border-brand-500 transition-colors"
                />
              </div>

              {preview && !previewDismissed && (
                <PreviewCard
                  url={url}
                  preview={preview}
                  onDismiss={() => setPreviewDismissed(true)}
                />
              )}
            </div>

            {/* Image upload */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Image <span className="text-gray-400 font-normal">— optional</span>
              </p>
              <ImageUploadZone
                key={uploadKey}
                onUploaded={setImageUrl}
                onRemoved={() => setImageUrl(null)}
                onUploadingChange={setIsUploading}
              />
            </div>

            {/* Category */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Category <span className="text-red-400">*</span>
              </p>
              <CategoryPicker value={category} onChange={setCategory} />
            </div>

            {/* Submit error */}
            {submitError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                {submitError}
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
              disabled={!canSubmit}
              className="px-5 py-2 rounded-full text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Posting…
                </span>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
