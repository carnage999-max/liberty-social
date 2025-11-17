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

export type FriendshipAction = "added" | "removed";
export type RemovalReason = "unfriended_by_user" | "unfriended_by_friend" | "both_mutual";

export interface FriendshipHistory {
  id: number;
  user: string; // UUID
  friend: User;
  action: FriendshipAction;
  action_display: string;
  removal_reason?: RemovalReason | null;
  removal_reason_display?: string | null;
  created_at: string;
}

// ----------------------
// POSTS, COMMENTS, REACTIONS
// ----------------------

export type Visibility = "public" | "friends" | "only_me";

export interface Post {
  id: number;
  author: User;
  author_type: "user" | "page";
  page?: PageSummary | null;
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

// ----------------------
// PAGES
// ----------------------

export type PageRole = "owner" | "admin" | "editor" | "moderator";

export interface PageSummary {
  id: number;
  name: string;
  category: string;
  profile_image_url?: string | null;
  cover_image_url?: string | null;
  is_verified?: boolean;
}

export interface Page extends PageSummary {
  description?: string;
  website_url?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_by: User;
  created_at: string;
  updated_at: string;
  follower_count?: number;
  admin_count?: number;
  is_following?: boolean;
}

export interface PageAdmin {
  id: number;
  page: number;
  user: User;
  role: PageRole;
  added_by: User;
  added_at: string;
}

export type PageInviteStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface PageAdminInvite {
  id: number;
  page: PageSummary;
  inviter: User;
  invitee: User;
  role: Exclude<PageRole, "owner">;
  status: PageInviteStatus;
  invited_at: string;
  responded_at?: string | null;
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

export interface DeviceToken {
  id: number;
  token: string;
  platform: "ios" | "android" | "web";
  created_at: string;
  last_seen_at: string;
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
// MESSAGING
// ----------------------

export interface ConversationParticipant {
  id: number;
  user: User;
  role: "member" | "admin";
  joined_at: string;
  last_read_at?: string | null;
}

export interface Message {
  id: number;
  conversation: number;
  sender: User;
  content?: string | null;
  media_url?: string | null;
  reply_to?: number | null;
  is_deleted: boolean;
  edited_at?: string | null;
  reactions?: Reaction[];
  reaction_summary?: ReactionSummary;
  created_at: string;
  updated_at: string;
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

// ----------------------
// MARKETPLACE
// ----------------------

export interface MarketplaceCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon_url?: string | null;
  is_active: boolean;
}

export type ListingCondition = "new" | "like_new" | "used" | "fair" | "poor";
export type ContactPreference = "chat" | "call" | "both";
export type DeliveryOption = "pickup" | "delivery" | "both";
export type ListingStatus = "active" | "sold" | "expired" | "draft";

export interface MarketplaceListingMedia {
  id: number;
  url: string;
  content_type?: string | null;
  order: number;
}

export interface MarketplaceListing {
  id: number;
  seller: User;
  title: string;
  description: string;
  category: MarketplaceCategory | number;
  price: string;
  condition: ListingCondition;
  contact_preference: ContactPreference;
  delivery_options: DeliveryOption;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  status: ListingStatus;
  views_count: number;
  saved_count: number;
  media?: MarketplaceListingMedia[];
  is_verified: boolean;
  reported_count: number;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  sold_at?: string | null;
  is_saved?: boolean;
  saved_by?: any[];
  offers?: MarketplaceOffer[];
  reactions?: Reaction[];
}

export interface MarketplaceOffer {
  id: number;
  listing: number | MarketplaceListing;
  buyer: User;
  offered_price: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "expired";
  responded_at?: string | null;
  response_message: string;
  created_at: string;
  expires_at?: string | null;
}

export interface MarketplaceSave {
  id: number;
  user: User;
  listing: MarketplaceListing;
  created_at: string;
}

export interface MarketplaceReport {
  id: number;
  listing: number;
  reporter: User;
  reason: string;
  description: string;
  status: "pending" | "under_review" | "resolved" | "dismissed";
  created_at: string;
}

export interface SellerVerification {
  id: number;
  seller: User;
  verification_type: "phone" | "email" | "id" | "address";
  status: "pending" | "approved" | "rejected";
  verified_at?: string | null;
  created_at: string;
}

// ----------------------
// ⚙️ GENERIC HELPERS
// ----------------------

export interface ApiError {
  detail?: string;
  [key: string]: any;
}
