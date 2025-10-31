"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiPatch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import {
  useUserSettings,
  type UserSettings,
} from "@/hooks/useUserSettings";
import type { BlockedUser } from "@/lib/types";
import { useEffect, useState } from "react";

type ProfileForm = {
  first_name: string;
  last_name: string;
  username: string;
  phone_number: string;
  bio: string;
  gender: string;
};

const PRIVACY_OPTIONS: Array<{
  value: UserSettings["profile_privacy"];
  label: string;
}> = [
  { value: "public", label: "Public" },
  { value: "private", label: "Friends only" },
  { value: "only_me", label: "Only me" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
];

export default function SettingsPage() {
  const toast = useToast();
  const { accessToken, user } = useAuth();

  const {
    data: profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile();

  const {
    data: settings,
    loading: settingsLoading,
    error: settingsError,
    updateSettings,
  } = useUserSettings();

  const {
    items: blockedUsers,
    loading: blockedLoading,
    error: blockedError,
    loadMore: loadMoreBlocked,
    loadingMore: loadingMoreBlocked,
    next: blockedNext,
    refresh: refreshBlocked,
  } = usePaginatedResource<BlockedUser>("/auth/blocks/");

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    username: "",
    phone_number: "",
    bio: "",
    gender: "",
  });

  const [privacyForm, setPrivacyForm] = useState<{
    profile_privacy: UserSettings["profile_privacy"];
    friends_publicity: UserSettings["friends_publicity"];
  }>({
    profile_privacy: "public",
    friends_publicity: "public",
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      username: profile.username ?? "",
      phone_number: (profile as any).phone_number ?? "",
      bio: (profile as any).bio ?? "",
      gender: (profile as any).gender ?? "",
    });
  }, [profile]);

  useEffect(() => {
    if (!settings) return;
    setPrivacyForm({
      profile_privacy: settings.profile_privacy,
      friends_publicity: settings.friends_publicity,
    });
  }, [settings]);

  const isLoading = profileLoading || settingsLoading || blockedLoading;

  const accountEmail = profile?.email ?? user?.email ?? "-";
  const memberSince = "-";

  const handleProfileChange = (field: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.id || !accessToken) return;
    try {
      setFormError(null);
      setSavingProfile(true);
      await apiPatch(`/auth/user/${user.id}/`, profileForm, {
        token: accessToken,
        cache: "no-store",
      });
      toast.show("Profile updated");
      refetchProfile();
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrivacySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setSavingPrivacy(true);
      const updated = await updateSettings(privacyForm);
      if (updated) {
        setPrivacyForm({
          profile_privacy: updated.profile_privacy,
          friends_publicity: updated.friends_publicity,
        });
      }
      toast.show("Settings saved");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleUnblock = async (blockId: number) => {
    if (!accessToken) return;
    try {
      setUnblockingId(blockId);
      await apiDelete(`/auth/blocks/${blockId}/`, {
        token: accessToken,
        cache: "no-store",
      });
      toast.show("User unblocked");
      await refreshBlocked();
    } catch (err) {
      console.error(err);
      toast.show("Could not unblock user. Please try again.");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <RequireAuth>
      <section className="min-h-screen bg-[var(--color-background)] pb-12 pt-24 sm:pt-28">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 sm:px-6 lg:flex-row">
          <div className="w-full lg:w-2/3">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">
                Manage your profile information, privacy preferences, and blocked users.
              </p>
            </header>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : (
              <div className="space-y-8">
                <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    This information appears on your profile and alongside your posts.
                  </p>

                  {formError && (
                    <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                      {formError}
                    </p>
                  )}
                  {profileError && (
                    <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                      {profileError}
                    </p>
                  )}

                  <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col text-sm font-medium text-gray-700">
                        First name
                        <input
                          value={profileForm.first_name}
                          onChange={(e) =>
                            handleProfileChange("first_name", e.target.value)
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </label>
                      <label className="flex flex-col text-sm font-medium text-gray-700">
                        Last name
                        <input
                          value={profileForm.last_name}
                          onChange={(e) =>
                            handleProfileChange("last_name", e.target.value)
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col text-sm font-medium text-gray-700">
                        Display name
                        <input
                          value={profileForm.username}
                          onChange={(e) =>
                            handleProfileChange("username", e.target.value)
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          placeholder="e.g. libertarian_dreamer"
                        />
                      </label>
                      <label className="flex flex-col text-sm font-medium text-gray-700">
                        Phone number
                        <input
                          value={profileForm.phone_number}
                          onChange={(e) =>
                            handleProfileChange("phone_number", e.target.value)
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          placeholder="+15551234567"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Bio
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) =>
                          handleProfileChange("bio", e.target.value)
                        }
                        rows={4}
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        placeholder="Tell people a little about yourself"
                      />
                    </label>
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Gender
                      <select
                        value={profileForm.gender}
                        onChange={(e) =>
                          handleProfileChange("gender", e.target.value)
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-5 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingProfile ? "Savingâ€¦" : "Save profile"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-gray-900">Privacy</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Decide who can discover your profile and connections.
                  </p>

                    {settingsError && (
                      <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                        {settingsError}
                      </p>
                    )}

                  <form onSubmit={handlePrivacySubmit} className="mt-6 space-y-4">
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Profile visibility
                      <select
                        value={privacyForm.profile_privacy}
                        onChange={(e) =>
                          setPrivacyForm((prev) => ({
                            ...prev,
                            profile_privacy:
                              e.target.value as UserSettings["profile_privacy"],
                          }))
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        {PRIVACY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Friends list visibility
                      <select
                        value={privacyForm.friends_publicity}
                        onChange={(e) =>
                          setPrivacyForm((prev) => ({
                            ...prev,
                            friends_publicity:
                              e.target.value as UserSettings["friends_publicity"],
                          }))
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        {PRIVACY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={savingPrivacy}
                        className="rounded-lg border border-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingPrivacy ? "Savingâ€¦" : "Save privacy settings"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Blocked users
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Remove someone from this list to allow them to contact you again.
                      </p>
                    </div>
                    <button
                      onClick={() => refreshBlocked()}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Refresh
                    </button>
                  </div>

                  {blockedError && (
                    <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                      {blockedError}
                    </p>
                  )}

                  {blockedUsers.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      You have not blocked anyone.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {blockedUsers.map((entry) => {
                        const shortId = entry.blocked_user
                          ? `${entry.blocked_user.slice(0, 8)}...`
                          : "Unknown user";
                        return (
                          <li
                            key={entry.id}
                            className="flex items-center justify-between gap-3 rounded-[14px] border border-gray-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {shortId}
                              </p>
                              <p className="text-xs text-gray-500">
                                Blocked {new Date(entry.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => handleUnblock(entry.id)}
                              disabled={unblockingId === entry.id}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {unblockingId === entry.id ? "Unblocking..." : "Unblock"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {blockedNext && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={loadMoreBlocked}
                        disabled={loadingMoreBlocked}
                        className="rounded-lg border border-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingMoreBlocked ? "Loading..." : "Load more"}
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          <aside className="w-full max-w-xs shrink-0 space-y-6 lg:w-1/3">
            <div className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-gray-900">Account</h2>
              <dl className="mt-3 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <dt>Email</dt>
                  <dd className="font-medium text-[var(--color-primary)]">{accountEmail}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Member since</dt>
                  <dd>{memberSince}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="text-sm font-semibold text-gray-900">Need help?</h2>
              <p className="mt-2 text-sm text-gray-500">
                Reach out to the Liberty Social team if you have questions about your account or privacy.
              </p>
              <a
                href="mailto:support@mylibertysocial.com"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:opacity-80"
              >
                Contact support
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12h14M12 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </aside>
        </div>
      </section>
    </RequireAuth>
  );
}







