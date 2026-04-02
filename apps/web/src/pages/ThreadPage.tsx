import { useParams } from "react-router-dom";

export default function ThreadPage() {
  const { id } = useParams();

  return (
    <div className="p-10 text-center text-gray-400 dark:text-gray-600">
      <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">Thread View</p>
      <p className="mt-1 text-sm">Post {id} and its threaded replies will render here.</p>
    </div>
  );
}
