import type {
  Post,
  User,
  UserProfile,
  CreatePostInput,
  CreateReplyInput,
  UpdatePostInput,
  UpdateProfileInput,
  PaginatedResponse,
  PresignedUrlResponse,
  LinkPreviewResponse,
  PostCategory,
} from "@ecfeed/shared";

const API_URL = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────

export const auth = {
  me: () => request<User>("/api/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  loginUrl: () => `${API_URL}/auth/google`,
};

// ─── Posts ───────────────────────────────────────────────────

export const posts = {
  list: (params?: { category?: PostCategory; cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    return request<PaginatedResponse<Post>>(`/api/posts?${query}`);
  },

  get: (id: string) => request<{ post: Post; replies: Post[] }>(`/api/posts/${id}`),

  create: (input: CreatePostInput) =>
    request<Post>("/api/posts", { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: UpdatePostInput) =>
    request<Post>(`/api/posts/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  delete: (id: string) =>
    request<void>(`/api/posts/${id}`, { method: "DELETE" }),

  reply: (postId: string, input: CreateReplyInput) =>
    request<Post>(`/api/posts/${postId}/replies`, { method: "POST", body: JSON.stringify(input) }),

  like: (id: string) =>
    request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: "POST" }),

  unlike: (id: string) =>
    request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: "DELETE" }),
};

// ─── Users ──────────────────────────────────────────────────

export const users = {
  profile: (id: string) => request<UserProfile>(`/api/users/${id}`),

  posts: (id: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    return request<PaginatedResponse<Post>>(`/api/users/${id}/posts?${query}`);
  },

  replies: (id: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    return request<PaginatedResponse<Post>>(`/api/users/${id}/replies?${query}`);
  },

  likes: (id: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    return request<PaginatedResponse<Post>>(`/api/users/${id}/likes?${query}`);
  },

  updateProfile: (input: UpdateProfileInput) =>
    request<User>("/api/users/me", { method: "PUT", body: JSON.stringify(input) }),
};

// ─── Uploads ────────────────────────────────────────────────

export const uploads = {
  presign: (filename: string, contentType: string) =>
    request<PresignedUrlResponse>("/api/presign", {
      method: "POST",
      body: JSON.stringify({ filename, contentType }),
    }),

  avatar: (filename: string, contentType: string) =>
    request<PresignedUrlResponse>("/api/avatar", {
      method: "POST",
      body: JSON.stringify({ filename, contentType }),
    }),

  linkPreview: (url: string) =>
    request<LinkPreviewResponse>("/api/link-preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  uploadToR2: async (uploadUrl: string, file: File) => {
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
  },
};
