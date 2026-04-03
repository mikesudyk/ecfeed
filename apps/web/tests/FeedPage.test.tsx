import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Post, PaginatedResponse } from "@ecfeed/shared";

// ─── Mocks ───────────────────────────────────────────────────

vi.mock("../src/lib/api", () => ({
  posts: { list: vi.fn(), like: vi.fn(), unlike: vi.fn() },
}));

vi.mock("../src/lib/theme-context", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("../src/lib/compose-context", () => ({
  useCompose: () => ({
    openCompose: vi.fn(),
    lastCreatedPost: null,
    consumeLastCreatedPost: vi.fn(),
  }),
}));

import { posts as postsApi } from "../src/lib/api";
import FeedPage from "../src/pages/FeedPage";

// ─── Fixture ─────────────────────────────────────────────────

function makePost(id: string, category: Post["category"] = "dev"): Post {
  return {
    id,
    authorId: "user-1",
    author: {
      id: "user-1",
      googleId: "g1",
      email: "alice@ecgroup-intl.com",
      displayName: "Alice",
      avatarUrl: null,
      bio: null,
      roleTitle: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    parentId: null,
    quotedPostId: null,
    quotedPost: null,
    title: null,
    body: `Post body ${id}`,
    url: null,
    imageUrl: null,
    category,
    depth: 0,
    replyCount: 0,
    likeCount: 0,
    likedByMe: false,
    linkPreview: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makePageResponse(posts: Post[]): PaginatedResponse<Post> {
  return { data: posts, cursor: null, hasMore: false };
}

function renderFeed() {
  return render(
    <MemoryRouter>
      <FeedPage />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────

describe("FeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all category filter buttons", () => {
    vi.mocked(postsApi.list).mockResolvedValue(makePageResponse([]));
    renderFeed();

    expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dev/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sales & Marketing/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Design/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Other/ })).toBeInTheDocument();
  });

  it("shows loading skeletons while fetching", () => {
    // Never resolves during this test
    vi.mocked(postsApi.list).mockReturnValue(new Promise(() => {}));
    const { container } = renderFeed();

    // Skeletons use animate-pulse — check they're present
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders post cards after data loads", async () => {
    vi.mocked(postsApi.list).mockResolvedValue(
      makePageResponse([makePost("p1"), makePost("p2")])
    );
    renderFeed();

    await waitFor(() => {
      expect(screen.getByText("Post body p1")).toBeInTheDocument();
      expect(screen.getByText("Post body p2")).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no posts", async () => {
    vi.mocked(postsApi.list).mockResolvedValue(makePageResponse([]));
    renderFeed();

    await waitFor(() =>
      expect(screen.getByText(/no posts yet/i)).toBeInTheDocument()
    );
  });

  it("calls the API with the selected category when a filter is clicked", async () => {
    vi.mocked(postsApi.list).mockResolvedValue(makePageResponse([]));
    renderFeed();

    // Wait for initial fetch to settle
    await waitFor(() => expect(postsApi.list).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Dev/ }));

    await waitFor(() => expect(postsApi.list).toHaveBeenCalledTimes(2));
    expect(postsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "dev" })
    );
  });

  it("calls the API without category when 'All' filter is active", async () => {
    vi.mocked(postsApi.list).mockResolvedValue(makePageResponse([]));
    renderFeed();

    await waitFor(() => expect(postsApi.list).toHaveBeenCalledTimes(1));

    const call = vi.mocked(postsApi.list).mock.calls[0][0];
    expect(call?.category).toBeUndefined();
  });

  it("shows an error message and retry button on API failure", async () => {
    vi.mocked(postsApi.list).mockRejectedValue(new Error("Network error"));
    renderFeed();

    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows the 'Load more' button when hasMore is true", async () => {
    vi.mocked(postsApi.list).mockResolvedValue({
      data: [makePost("p1")],
      cursor: "2024-01-01T00:00:00.000Z",
      hasMore: true,
    });
    renderFeed();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument()
    );
  });
});
