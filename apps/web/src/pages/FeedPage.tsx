import { useState } from "react";
import { CATEGORY_META, type PostCategory } from "@ecfeed/shared";

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "dev", label: "Dev" },
  { key: "ai", label: "AI" },
  { key: "sales_marketing", label: "Sales & Marketing" },
  { key: "design", label: "Design" },
  { key: "other", label: "Other" },
];

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div>
      {/* Category filter bar */}
      <div className="flex gap-1.5 px-6 py-3.5 border-b border-gray-100 dark:border-white/[0.06] overflow-x-auto">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const cat = f.key !== "all" ? CATEGORY_META[f.key as PostCategory] : null;

          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "text-white"
                  : "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
              style={
                isActive
                  ? { backgroundColor: cat?.color || (document.documentElement.classList.contains("dark") ? "#f9fafb" : "#111827"), color: isActive && !cat ? (document.documentElement.classList.contains("dark") ? "#111" : "#fff") : "#fff" }
                  : undefined
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Post list — placeholder */}
      <div className="p-10 text-center text-gray-400 dark:text-gray-600">
        <p className="text-4xl mb-3">🚀</p>
        <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">EC Feed is almost ready</p>
        <p className="mt-1 text-sm">Posts will appear here once the API is connected.</p>
      </div>
    </div>
  );
}
