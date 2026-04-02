import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import FeedPage from "./pages/FeedPage";
import ThreadPage from "./pages/ThreadPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<FeedPage />} />
        <Route path="/post/:id" element={<ThreadPage />} />
        <Route path="/user/:id" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
