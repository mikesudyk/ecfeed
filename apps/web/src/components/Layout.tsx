import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { useCompose } from "../lib/compose-context";
import { Avatar } from "./PostCard";

export default function Layout() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { openCompose } = useCompose();

  return (
    <div className="min-h-dvh bg-white dark:bg-[#0a0a0f]">
      <div className="mx-auto max-w-2xl border-x border-gray-100 dark:border-white/[0.06] min-h-dvh flex flex-col">
        {/* Header — safe area for notched devices in standalone PWA */}
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 dark:border-white/[0.06] bg-white/80 dark:bg-black/30 backdrop-blur-xl pt-[max(0.75rem,env(safe-area-inset-top))] pb-3.5 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="EC Feed" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
              EC Feed
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="p-1.5 rounded-lg text-lg"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {isAuthenticated ? (
              <>
                <button
                  onClick={() => openCompose()}
                  className="px-4 py-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-shadow"
                >
                  + New Post
                </button>
                <Link to={`/user/${user?.id}`}>
                  <Avatar user={user!} size="sm" />
                </Link>
              </>
            ) : (
              <button
                onClick={login}
                className="px-4 py-2 rounded-full bg-gray-100 dark:bg-white/[0.06] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-h-0 pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
