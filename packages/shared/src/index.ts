// ─── Categories ─────────────────────────────────────────────
export const POST_CATEGORIES = ["dev", "ai", "sales_marketing", "design", "other"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const CATEGORY_META: Record<PostCategory, { label: string; color: string }> = {
  dev: { label: "Dev", color: "#3b82f6" },
  ai: { label: "AI", color: "#8b5cf6" },
  sales_marketing: { label: "Sales & Marketing", color: "#10b981" },
  design: { label: "Design", color: "#ec4899" },
  other: { label: "Other", color: "#6b7280" },
};

// ─── User ───────────────────────────────────────────────────
export interface User {
  id: string;
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  roleTitle: string | null;
  createdAt: string;
}

export interface UserProfile extends User {
  postCount: number;
  likesReceived: number;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  roleTitle?: string;
}

// ─── Post ───────────────────────────────────────────────────
export interface Post {
  id: string;
  authorId: string;
  author: User;
  parentId: string | null;
  quotedPostId: string | null;
  quotedPost: Post | null;
  title: string | null;
  body: string;
  url: string | null;
  imageUrl: string | null;
  category: PostCategory;
  depth: number;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  linkPreview: LinkPreview | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  title?: string;
  body: string;
  url?: string;
  imageUrl?: string;
  category: PostCategory;
  quotedPostId?: string;
}

export interface CreateReplyInput {
  body: string;
  parentId?: string; // if omitted, replies directly to the post
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  url?: string;
  imageUrl?: string;
  category?: PostCategory;
}

// ─── Link Preview ───────────────────────────────────────────
export interface LinkPreview {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  fetchedAt: string;
}

// ─── Like ───────────────────────────────────────────────────
export interface Like {
  userId: string;
  postId: string;
  user: Pick<User, "id" | "displayName" | "avatarUrl">;
  createdAt: string;
}

// ─── API Responses ──────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export interface LinkPreviewResponse {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
}

// ─── Auth ───────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Constants ──────────────────────────────────────────────
export const MAX_BODY_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 200;
export const MAX_BIO_LENGTH = 280;
export const MAX_ROLE_TITLE_LENGTH = 100;
export const MAX_REPLY_DEPTH = 4;
export const MAX_IMAGE_SIZE_MB = 5;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const POSTS_PER_PAGE = 20;
export const ALLOWED_DOMAIN = "ecgroup-intl.com";
