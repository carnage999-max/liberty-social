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
