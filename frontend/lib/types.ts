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
  username?: string;
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
}

export interface Comment {
  id: number;
  post: number;
  author: User;
  content: string;
  parent?: number | null;
  created_at: string;
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
