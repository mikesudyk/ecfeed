import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PostCard } from "../src/components/PostCard";
import type { Post } from "@ecfeed/shared";

// ─── Fixtures ────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    authorId: "user-1",
    author: {
      id: "user-1",
      googleId: "google-1",
      email: "alice@ecgroup-intl.com",
      displayName: "Alice Smith",
      avatarUrl: null,
      bio: null,
      roleTitle: "Frontend Dev",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    parentId: null,
    quotedPostId: null,
    quotedPost: null,
    title: null,
    body: "Hello world",
    url: null,
    imageUrl: null,
    category: "dev",
    depth: 0,
    replyCount: 0,
    likeCount: 0,
    likedByMe: false,
    linkPreview: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(post: Post, props = {}) {
  return render(
    <MemoryRouter>
      <PostCard post={post} {...props} />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────

describe("PostCard", () => {
  it("renders author display name", () => {
    renderCard(makePost());
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders the post body", () => {
    renderCard(makePost({ body: "Learning is fun" }));
    expect(screen.getByText("Learning is fun")).toBeInTheDocument();
  });

  it("renders the category badge", () => {
    renderCard(makePost({ category: "ai" }));
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("renders the role title when present", () => {
    renderCard(makePost());
    expect(screen.getByText("Frontend Dev")).toBeInTheDocument();
  });

  it("renders the post title when provided", () => {
    renderCard(makePost({ title: "My Announcement" }));
    expect(screen.getByText("My Announcement")).toBeInTheDocument();
  });

  it("truncates long body and shows a 'Show more' button", () => {
    const longBody = "a".repeat(300);
    renderCard(makePost({ body: longBody }));
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
    // Truncated body ends with ellipsis
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it("expands the full body when 'Show more' is clicked", () => {
    const longBody = "x".repeat(300);
    renderCard(makePost({ body: longBody }));
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("does not show 'Show more' for short posts", () => {
    renderCard(makePost({ body: "Short post" }));
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("calls onLike when the like button is clicked and post is not liked", () => {
    const onLike = vi.fn();
    renderCard(makePost({ likedByMe: false, likeCount: 3 }), { onLike });
    fireEvent.click(screen.getByRole("button", { name: /like/i }));
    expect(onLike).toHaveBeenCalledWith("post-1");
  });

  it("calls onUnlike when the like button is clicked and post is already liked", () => {
    const onUnlike = vi.fn();
    renderCard(makePost({ likedByMe: true, likeCount: 5 }), { onUnlike });
    fireEvent.click(screen.getByRole("button", { name: /unlike/i }));
    expect(onUnlike).toHaveBeenCalledWith("post-1");
  });

  it("shows the like count when greater than zero", () => {
    renderCard(makePost({ likeCount: 12 }));
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders a post image when imageUrl is present", () => {
    const { container } = renderCard(makePost({ imageUrl: "https://example.com/photo.jpg" }));
    // The image is wrapped in a "View full image" button
    expect(screen.getByRole("button", { name: /view full image/i })).toBeInTheDocument();
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("calls onReply when the reply button is clicked", () => {
    const onReply = vi.fn();
    renderCard(makePost(), { onReply });
    fireEvent.click(screen.getByRole("button", { name: /repl/i }));
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: "post-1" }));
  });
});
