import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export interface FeedPreference {
  id: number;
  user: number;
  show_friend_posts: boolean;
  show_page_posts: boolean;
  preferred_categories: string[];
  show_other_categories: boolean;
  created_at: string;
  updated_at: string;
  category_choices: Array<[string, string]>;
}

interface UseFeedPreferencesReturn {
  preferences: FeedPreference | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (updates: Partial<FeedPreference>) => Promise<FeedPreference | null>;
  refetch: () => Promise<void>;
}

export function useFeedPreferences(): UseFeedPreferencesReturn {
  const { accessToken } = useAuth();
  const [preferences, setPreferences] = useState<FeedPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiGet("/feed-preferences/me/", {
        token: accessToken,
      });
      setPreferences(data);
    } catch (err: any) {
      console.error("Failed to fetch feed preferences:", err);
      setError(err?.message || "Failed to fetch preferences");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(
    async (updates: Partial<FeedPreference>): Promise<FeedPreference | null> => {
      if (!accessToken) {
        setError("Not authenticated");
        return null;
      }

      try {
        setError(null);
        const response = await apiPatch(
          "/feed-preferences/me/",
          updates,
          {
            token: accessToken,
            cache: "no-store",
          }
        );
        setPreferences(response);
        return response;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to update preferences";
        setError(errorMsg);
        console.error("Failed to update feed preferences:", err);
        return null;
      }
    },
    [accessToken]
  );

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  };
}
