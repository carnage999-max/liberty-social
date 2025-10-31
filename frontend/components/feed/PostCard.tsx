// components/feed/PostCard.tsx
import { User } from "@/lib/types";

interface PostCardProps {
  author: Partial<User>;
  content: string;
  created_at: string;
}

export default function PostCard({
  author,
  content,
  created_at,
}: PostCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm shadow-sm rounded-[16px] p-4 border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={author.profile_image_url || "/images/default-avatar.png"}
          alt={author.username || "User"}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <p className="font-semibold text-gray-800">{author.username}</p>
          <p className="text-xs text-gray-500">{created_at}</p>
        </div>
      </div>
      <p className="text-gray-700">{content}</p>
    </div>
  );
}
