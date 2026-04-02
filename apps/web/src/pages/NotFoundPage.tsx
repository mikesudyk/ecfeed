import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="p-10 text-center">
      <p className="text-5xl mb-4">🤔</p>
      <p className="text-xl font-bold text-gray-800 dark:text-gray-200">Page not found</p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm font-semibold text-indigo-500 hover:text-indigo-400 transition-colors"
      >
        ← Back to feed
      </Link>
    </div>
  );
}
