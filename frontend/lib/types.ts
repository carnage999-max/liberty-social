// lib/types.ts
// Auto-generated based on your Liberty Social API schema
// Provides TypeScript interfaces and enums for type-safe frontend usage

// ----------------------
// AUTHENTICATION
// ----------------------

export interface AuthTokens {
  refresh_token: string;
  access_token: string;
  user_id: string;
}

export interface LoginRequest {
  username: string; // can be email, username, or phone
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
  phone_number?: string | null;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username?: string | null;
  phone_number?: string | null;
  profile_image_url?: string | null;
  bio?: string | null;
  gender?: string | null;
  date_joined?: string;
}

export type RelationshipStatus =
  | "self"
  | "viewer_blocked"
  | "blocked_by_target"
  | "friend"
  | "incoming_request"
  | "outgoing_request"
  | "none";

export interface UserProfileRelationship {
  is_self: boolean;
  is_friend: boolean;
  status: RelationshipStatus;
  incoming_request: boolean;
  incoming_request_id?: number | null;
  outgoing_request: boolean;
  outgoing_request_id?: number | null;
  friend_entry_id?: number | null;
  viewer_has_blocked: boolean;
  viewer_block_id?: number | null;
  blocked_by_target: boolean;
  can_send_friend_request: boolean;
}

export interface UserProfileStats {
  post_count: number | null;
  friend_count: number | null;
  photos: string[];
}

export interface UserProfileOverview {
  user: {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_image_url?: string | null;
    bio?: string | null;
    date_joined?: string | null;
  };
  stats: UserProfileStats;
  relationship: UserProfileRelationship;
  recent_posts: Post[];
  can_view_posts: boolean;
  can_view_friend_count: boolean;
  privacy: {
    profile_privacy: string;
    friends_publicity: string;
  };
}

// ----------------------
// FRIENDS & REQUESTS
// ----------------------

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: number;
  from_user: User;
  to_user: User;
  to_user_id?: string; // user_id (UUID)
  status: FriendRequestStatus;
  created_at: string;
}

export interface Friend {
  username: string;
  id: number;
  user: string; // UUID
  friend: User;
  friend_id: string;
  created_at: string;
}

export interface BlockedUser {
  id: number;
  user: User;
  blocked_user: string; // UUID
  created_at: string;
}

// ----------------------
// POSTS, COMMENTS, REACTIONS
// ----------------------

export type Visibility = "public" | "friends" | "only_me";

export interface Post {
  id: number;
  author: User;
  content: string;
  media?: string[] | null;
  media_urls?: string[];
  visibility?: Visibility;
  created_at: string;
  updated_at: string;
  comments: Comment[];
  reactions: Reaction[];
  bookmarked?: boolean;
  bookmark_id?: number | null;
}

export type ReactionSummary = {
  total: number;
  by_type: Record<ReactionType, number>;
};

export interface Comment {
  id: number;
  post: number;
  author: User;
  content: string;
  media?: string[] | null;
  parent?: number | null;
  created_at: string;
  reactions?: Reaction[];
  reaction_summary?: ReactionSummary | null;
  replies_count?: number;
  user_reaction?: Reaction | null;
  replies?: Comment[];
}

export type ReactionType = "like" | "love" | "haha" | "sad" | "angry";

export interface Reaction {
  id: number;
  post?: number;
  comment?: number;
  user: User;
  reaction_type: ReactionType;
  created_at: string;
}

// ----------------------
// NOTIFICATIONS
// ----------------------

export interface Notification {
  id: number;
  actor: User;
  verb: string;
  content_type?: number | null;
  object_id?: number | null;
  unread: boolean;
  created_at: string;
  target_post_id?: number | null;
  target_post_preview?: string | null;
  target_comment_preview?: string | null;
}

// ----------------------
// BOOKMARKS
// ----------------------

export interface Bookmark {
  id: number;
  user: User;
  post: number;
  created_at: string;
}

// ----------------------
// 📸 UPLOADS
// ----------------------

export interface UploadResponse {
  url: string;
}

// ----------------------
// ⚙️ GENERIC HELPERS
// ----------------------

export interface ApiError {
  detail?: string;
  [key: string]: any;
}
