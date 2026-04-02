// vi.mock must be at the top — it is hoisted before imports by Vitest
vi.mock("../src/db/pool.js", () => ({
  default: { query: vi.fn() },
}));

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pool from "../src/db/pool.js";
import postsRouter from "../src/routes/posts.js";
import { signToken } from "../src/middleware/auth.js";
import { errorHandler } from "../src/middleware/errors.js";
import { MAX_REPLY_DEPTH } from "@ecfeed/shared";

// ─── Helpers ─────────────────────────────────────────────────

const mockQuery = vi.mocked(pool.query);

function makePostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    author_id: "user-1",
    author_display_name: "Alice",
    author_avatar_url: null,
    author_email: "alice@ecgroup-intl.com",
    author_role_title: null,
    parent_id: null,
    quoted_post_id: null,
    qp_body: null,
    qp_title: null,
    qp_author_id: null,
    qp_created_at: null,
    qp_author_name: null,
    qp_author_avatar: null,
    lp_url: null,
    lp_title: null,
    lp_description: null,
    lp_image_url: null,
    lp_site_name: null,
    lp_favicon_url: null,
    title: null,
    body: "Hello world",
    url: null,
    image_url: null,
    category: "dev",
    depth: 0,
    reply_count: "0",
    like_count: "0",
    liked_by_me: false,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function authCookie(userId = "user-1", email = "alice@ecgroup-intl.com") {
  return { Cookie: `token=${signToken({ userId, email })}` };
}

// ─── Test server ─────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use("/api/posts", postsRouter);
      app.use(errorHandler);
      server = http.createServer(app).listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://localhost:${addr.port}/api/posts`;
        resolve();
      });
    })
);

afterAll(
  () => new Promise<void>((resolve) => server.close(() => resolve()))
);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────

describe("GET /api/posts", () => {
  it("returns a paginated list of posts", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makePostRow()], rowCount: 1 } as any);

    const res = await fetch(baseUrl);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("post-1");
    expect(body.hasMore).toBe(false);
  });

  it("filters by category when ?category= is provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await fetch(`${baseUrl}?category=ai`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    // Verify the query included the category param
    expect(mockQuery).toHaveBeenCalledOnce();
    const sql: string = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/category/i);
  });
});

describe("DELETE /api/posts/:id", () => {
  it("returns 401 with no auth", async () => {
    const res = await fetch(`${baseUrl}/post-1`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when post does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await fetch(`${baseUrl}/nonexistent`, {
      method: "DELETE",
      headers: authCookie(),
    });

    expect(res.status).toBe(404);
  });

  it("returns 403 when user does not own the post", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ author_id: "user-2", parent_id: null }],
      rowCount: 1,
    } as any);

    const res = await fetch(`${baseUrl}/post-1`, {
      method: "DELETE",
      headers: authCookie("user-1"),
    });

    expect(res.status).toBe(403);
  });

  it("returns 204 when user owns the post", async () => {
    // SELECT author_id, parent_id
    mockQuery.mockResolvedValueOnce({
      rows: [{ author_id: "user-1", parent_id: null }],
      rowCount: 1,
    } as any);
    // DELETE FROM posts
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await fetch(`${baseUrl}/post-1`, {
      method: "DELETE",
      headers: authCookie("user-1"),
    });

    expect(res.status).toBe(204);
  });
});

describe("POST /api/posts/:id/replies — depth enforcement", () => {
  it(`rejects replies beyond MAX_REPLY_DEPTH (${MAX_REPLY_DEPTH})`, async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "post-1", depth: MAX_REPLY_DEPTH, category: "dev", parent_id: null }],
      rowCount: 1,
    } as any);

    const res = await fetch(`${baseUrl}/post-1/replies`, {
      method: "POST",
      headers: { ...authCookie(), "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Too deep" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/depth/i);
  });

  it("allows a reply when parent depth is within limit", async () => {
    const parentDepth = MAX_REPLY_DEPTH - 1;
    // 1. Get parent post
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "post-1", depth: parentDepth, category: "dev", parent_id: null }],
      rowCount: 1,
    } as any);
    // 2. Get root post category
    mockQuery.mockResolvedValueOnce({ rows: [{ category: "dev" }], rowCount: 1 } as any);
    // 3. INSERT reply
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "reply-1" }], rowCount: 1 } as any);
    // 4. UPDATE reply_count
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    // 5. Re-fetch reply with joins
    mockQuery.mockResolvedValueOnce({
      rows: [makePostRow({ id: "reply-1", depth: MAX_REPLY_DEPTH })],
      rowCount: 1,
    } as any);

    const res = await fetch(`${baseUrl}/post-1/replies`, {
      method: "POST",
      headers: { ...authCookie(), "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Valid reply" }),
    });

    expect(res.status).toBe(201);
  });
});

describe("Like / Unlike", () => {
  it("POST /:id/like returns { liked: true }", async () => {
    // 1. Verify post exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "post-1" }], rowCount: 1 } as any);
    // 2. INSERT into likes
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    // 3. UPDATE like_count
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await fetch(`${baseUrl}/post-1/like`, {
      method: "POST",
      headers: authCookie(),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: true });
  });

  it("POST /:id/like returns 404 for a nonexistent post", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await fetch(`${baseUrl}/nonexistent/like`, {
      method: "POST",
      headers: authCookie(),
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id/like returns { liked: false }", async () => {
    // 1. DELETE from likes
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    // 2. UPDATE like_count
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await fetch(`${baseUrl}/post-1/like`, {
      method: "DELETE",
      headers: authCookie(),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: false });
  });

  it("POST /:id/like returns 401 with no auth", async () => {
    const res = await fetch(`${baseUrl}/post-1/like`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});
