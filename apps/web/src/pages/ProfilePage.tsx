import { useParams } from "react-router-dom";

export default function ProfilePage() {
  const { id } = useParams();

  return (
    <div className="p-10 text-center text-gray-400 dark:text-gray-600">
      <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">Profile</p>
      <p className="mt-1 text-sm">User {id}'s profile, bio, and post history will render here.</p>
    </div>
  );
}
