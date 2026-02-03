export type SignupDailyEntry = {
  date: string;
  count: number;
};

export type SignupMonthlyEntry = {
  month: string;
  count: number;
};

export interface AdminMetrics {
  generated_at: string;
  totals: {
    users: number;
  };
  new_users: {
    last_24_hours: number;
    last_7_days: number;
    last_30_days: number;
  };
  users_with_posts: number;
  signups_per_day: SignupDailyEntry[];
  signups_per_month: SignupMonthlyEntry[];
}

export interface LoginSuccess {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export type AdminActionLogEntry = {
  id: number;
  action_type: string;
  target_type: string;
  target_id: string;
  performed_by?: { id?: number; username?: string } | null;
  notes?: string | null;
  created_at?: string | null;
};

// Admin Security types (Phase 3)
export type UserSecurityStatus = {
  user_id: string;
  email: string;
  has_passkey: boolean;
  active_devices: number;
  active_sessions: number;
  account_locked: boolean;
  account_locked_at: string | null;
  locked_reason: string | null;
  recent_events: Array<{
    event_type: string;
    description: string;
    ip_address: string | null;
    created_at: string;
  }>;
};

export type UserDevice = {
  id: string;
  device_name: string;
  device_info: Record<string, unknown> | null;
  ip_address: string | null;
  location: string | null;
  last_seen_ip: string | null;
  last_seen_location: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type UserActivityEntry = {
  id: string;
  device_id: string | null;
  device_name: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  authentication_method: string;
  created_at: string;
  ended_at: string | null;
};

export type UserSearchResult = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  href: string;
  relevance_score: number;
};

export type ModerationActionEntry = {
  id: number;
  content_type: { id: number; app_label: string; model: string } | null;
  object_id: string | null;
  layer: string;
  action: string;
  reason_code: string;
  rule_ref: string;
  metadata: Record<string, unknown>;
  actor: string | number | null;
  created_at: string;
};

export type ContentClassificationEntry = {
  id: number;
  content_type: { id: number; app_label: string; model: string } | null;
  object_id: string;
  model_version: string;
  labels: string[];
  confidences: Record<string, number>;
  features: Record<string, unknown>;
  actor: string | number | null;
  created_at: string;
};

export type ComplianceLogEntry = {
  id: number;
  layer: string;
  category: string;
  content_type: { id: number; app_label: string; model: string } | null;
  object_id: string | null;
  content_snippet?: string | null;
  content_hash?: string | null;
  metadata?: Record<string, unknown> | null;
  actor: string | number | null;
  created_at: string;
};

export type AppealEntry = {
  id: number;
  moderation_action: number;
  user: string | number;
  reason: string;
  status: string;
  decided_by?: string | number | null;
  decided_at?: string | null;
  created_at: string;
};
