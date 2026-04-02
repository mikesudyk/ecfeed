import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Post } from "@ecfeed/shared";
import { ComposeModal } from "../components/ComposeModal";

interface ComposeContextValue {
  openCompose: (quotedPost?: Post) => void;
  lastCreatedPost: Post | null;
  consumeLastCreatedPost: () => void;
}

const ComposeContext = createContext<ComposeContextValue>({
  openCompose: () => {},
  lastCreatedPost: null,
  consumeLastCreatedPost: () => {},
});

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const [lastCreatedPost, setLastCreatedPost] = useState<Post | null>(null);

  const openCompose = useCallback((post?: Post) => {
    setQuotedPost(post ?? null);
    setIsOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    // Keep quotedPost alive until after the exit animation (300ms) so the
    // modal doesn't flash blank while closing.
    setTimeout(() => setQuotedPost(null), 350);
  }, []);

  const consumeLastCreatedPost = useCallback(() => setLastCreatedPost(null), []);

  const handleCreated = useCallback((post: Post) => {
    setLastCreatedPost(post);
    setIsOpen(false);
    setTimeout(() => setQuotedPost(null), 350);
  }, []);

  return (
    <ComposeContext.Provider value={{ openCompose, lastCreatedPost, consumeLastCreatedPost }}>
      {children}
      <ComposeModal
        isOpen={isOpen}
        quotedPost={quotedPost}
        onClose={closeCompose}
        onCreated={handleCreated}
      />
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  return useContext(ComposeContext);
}
