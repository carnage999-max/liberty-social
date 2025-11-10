import { ImageSourcePropType } from "react-native";

// Types matching the website API
export interface AuthTokens {
  refresh_token: string;
  access_token: string;
  user_id: string;
}

export interface LoginRequest {
  username: string;
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

export type ReactionType = 'like' | 'love' | 'haha' | 'sad' | 'angry';

export interface Reaction {
  id: number;
  post?: number;
  comment?: number;
  user: User;
  reaction_type: ReactionType;
  created_at: string;
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

export type Visibility = 'public' | 'friends' | 'only_me';

export interface Post {
  authorAvatar: ImageSourcePropType | undefined;
  mediaUrls: any;
  id: number;
  author: User;
  content: string;
  media?: string[] | null;
  visibility?: Visibility;
  created_at: string;
  updated_at: string;
  comments: Comment[];
  reactions: Reaction[];
  bookmarked?: boolean;
  bookmark_id?: number | null;
}

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

export interface Friend {
  id: number;
  user: string;
  friend: User;
  friend_id: string;
  created_at: string;
}

export interface FriendRequest {
  id: number;
  from_user: User;
  to_user: User;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserProfileStats {
  post_count: number | null;
  friend_count: number | null;
  photos: string[];
}

export interface UserProfileRelationship {
  is_self: boolean;
  is_friend: boolean;
  status: string;
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

export interface BlockedUser {
  id: number;
  user: User;
  blocked_user: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation: number;
  sender: User;
  content: string;
  media_url?: string | null;
  reply_to?: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  user: User;
  role: 'member' | 'admin';
  joined_at: string;
  last_read_at?: string | null;
}

export interface Conversation {
  id: number;
  title?: string | null;
  is_group: boolean;
  created_by: User;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  participants: ConversationParticipant[];
  last_message?: Message | null;
}
