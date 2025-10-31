// components/feed/Feed.tsx
"use client";

import CreatePost from "@/components/feed/CreatePost";
import PostCard from "./PostCard";

export default function Feed() {
  return (
    <div className="space-y-6">
      <CreatePost />
      <div className="space-y-4">
        <PostCard
          author={{ username: "john_doe" }}
          content="Just joined Liberty Social! Loving the vibe here 🚀"
          created_at="Just now"
        />
        <PostCard
          author={{ username: "alice" }}
          content="Can't wait to see how Liberty grows!"
          created_at="5 mins ago"
        />
      </div>
    </div>
  );
}
