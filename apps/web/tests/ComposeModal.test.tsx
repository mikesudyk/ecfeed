import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ComposeModal } from "../src/components/ComposeModal";
import type { Post } from "@ecfeed/shared";

// Mock the API so no real HTTP calls are made
vi.mock("../src/lib/api", () => ({
  posts: { create: vi.fn() },
  uploads: { presign: vi.fn(), linkPreview: vi.fn() },
}));

// ─── Fixture ─────────────────────────────────────────────────

const noop = () => {};

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "quoted-1",
    authorId: "user-2",
    author: {
      id: "user-2",
      googleId: "g2",
      email: "bob@ecgroup-intl.com",
      displayName: "Bob Jones",
      avatarUrl: null,
      bio: null,
      roleTitle: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    parentId: null,
    quotedPostId: null,
    quotedPost: null,
    title: "Original post",
    body: "This is the quoted content",
    url: null,
    imageUrl: null,
    category: "ai",
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

function renderModal(props: {
  isOpen?: boolean;
  quotedPost?: Post | null;
  onClose?: () => void;
  onCreated?: (post: Post) => void;
}) {
  return render(
    <MemoryRouter>
      <ComposeModal
        isOpen={props.isOpen ?? true}
        quotedPost={props.quotedPost ?? null}
        onClose={props.onClose ?? noop}
        onCreated={props.onCreated ?? noop}
      />
    </MemoryRouter>
  );
}

// ─── Tests ───────────────────────────────────────────────────

describe("ComposeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the compose dialog when isOpen is true", async () => {
    renderModal({ isOpen: true });
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
  });

  it("shows 'New Post' heading in normal mode", async () => {
    renderModal({ isOpen: true, quotedPost: null });
    await waitFor(() => expect(screen.getByText("New Post")).toBeInTheDocument());
  });

  it("shows 'Quote Post' heading when a quotedPost is provided", async () => {
    renderModal({ isOpen: true, quotedPost: makePost() });
    await waitFor(() => expect(screen.getByText("Quote Post")).toBeInTheDocument());
  });

  it("displays the quoted post body in quote mode", async () => {
    renderModal({ isOpen: true, quotedPost: makePost() });
    await waitFor(() =>
      expect(screen.getByText("This is the quoted content")).toBeInTheDocument()
    );
  });

  it("submit button is disabled when body is empty", async () => {
    renderModal({ isOpen: true });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Select a category so only body is missing
    fireEvent.click(screen.getByRole("button", { name: /dev/i }));

    const submitBtn = screen.getByRole("button", { name: /^post$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button is disabled when category is not selected", async () => {
    renderModal({ isOpen: true });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Type body but don't pick a category
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), {
      target: { value: "Some great insight" },
    });

    const submitBtn = screen.getByRole("button", { name: /^post$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button is enabled when body and category are both filled", async () => {
    renderModal({ isOpen: true });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), {
      target: { value: "Some great insight" },
    });
    fireEvent.click(screen.getByRole("button", { name: /dev/i }));

    const submitBtn = screen.getByRole("button", { name: /^post$/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("pre-selects the quoted post's category", async () => {
    renderModal({ isOpen: true, quotedPost: makePost({ category: "ai" }) });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // After open the AI category button should have the selected style (tested via aria or visual indicator)
    // We verify by checking the submit button becomes enabled once body is typed
    fireEvent.change(screen.getByPlaceholderText(/add your thoughts/i), {
      target: { value: "My thoughts" },
    });

    const submitBtn = screen.getByRole("button", { name: /^post$/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls onClose when the Cancel button is clicked", async () => {
    const onClose = vi.fn();
    renderModal({ isOpen: true, onClose });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the Escape key is pressed", async () => {
    const onClose = vi.fn();
    renderModal({ isOpen: true, onClose });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
