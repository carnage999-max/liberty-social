// components/feed/CreatePost.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    // TODO: send to /api/posts/
    setContent("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/90 rounded-[16px] p-4 shadow-sm border border-gray-100"
    >
      <textarea
        placeholder={`What's on your mind, ${user?.first_name || "friend"}?`}
        className="w-full resize-none rounded-lg border border-gray-200 bg-transparent p-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-gray-700"
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex justify-end mt-3">
        <button
          type="submit"
          className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Post
        </button>
      </div>
    </form>
  );
}
