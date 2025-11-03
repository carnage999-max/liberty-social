"use client";

import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
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
  const { accessToken, user, rawUser, refreshUser } = useAuth();

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
  const [blockToUnblock, setBlockToUnblock] = useState<BlockedUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleChangePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accessToken) {
      toast.show("You must be logged in to change your password.", "error");
      return;
    }
    try {
      setPasswordError(null);
      setChangingPassword(true);
      await apiPost("/auth/change-password/", changePasswordForm, {
        token: accessToken,
      });
      setChangePasswordForm({
        old_password: '',
        new_password: '',
      });
      toast.show("Password successfully changed.");
    } catch (err: any) {
      console.error(err);
      setPasswordError(err?.message || "Unable to change password.");
    } finally {
      setChangingPassword(false);
    }
  };
  const [changePasswordForm, setChangePasswordForm] = useState({
    old_password: '',
    new_password: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      username: profile.username ?? "",
      phone_number: profile.phone_number ?? "",
      bio: profile.bio ?? "",
      gender: profile.gender ?? "",
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

  const resolvedUser =
    profile ?? (rawUser && !Array.isArray(rawUser) ? rawUser : Array.isArray(rawUser) ? rawUser[0] : null) ?? user;

  const accountEmail = resolvedUser?.email ?? "-";
  const joinedSource = resolvedUser?.date_joined;
  const memberSince = joinedSource ? new Date(joinedSource).toLocaleDateString() : "-";

  const handleProfileChange = (field: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const targetId = profile?.id || (rawUser && !Array.isArray(rawUser) ? rawUser.id : undefined);
    if (!targetId || !accessToken) {
      toast.show("Unable to update profile right now.", "error");
      return;
    }
    try {
      setFormError(null);
      setSavingProfile(true);
      const payload: Record<string, string | null> = {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
      };

      const trimmedUsername = profileForm.username.trim();
      if (trimmedUsername) {
        payload.username = trimmedUsername;
      }

      const trimmedBio = profileForm.bio.trim();
      payload.bio = trimmedBio ? trimmedBio : null;

      const trimmedPhone = profileForm.phone_number.trim();
      payload.phone_number = trimmedPhone ? trimmedPhone : null;

      const trimmedGender = profileForm.gender.trim();
      if (trimmedGender) {
        payload.gender = trimmedGender;
      }
      await apiPatch(`/auth/user/${targetId}/`, payload, {
        token: accessToken,
        cache: "no-store",
      });
      toast.show("Profile updated");
      refetchProfile();
      await refreshUser();
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

  const handleUnblockClick = (block: BlockedUser) => {
    setBlockToUnblock(block);
  };

  const handleUnblock = async () => {
    if (!accessToken || !blockToUnblock) return;
    const blockId = blockToUnblock.id;
    setBlockToUnblock(null);
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
      toast.show("Could not unblock user. Please try again.", "error");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 sm:px-6 lg:flex-row">
        <div className="w-full lg:w-2/3">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">
                Manage your profile information, privacy preferences, and blocked users.
              </p>
            </div>
          </header>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-8">
              <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Update your password to keep your account secure.
                </p>

                {passwordError && (
                  <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {passwordError}
                  </p>
                )}

                <form onSubmit={handleChangePasswordSubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Current Password
                      <input
                        type="password"
                        value={changePasswordForm.old_password}
                        onChange={(e) =>
                          setChangePasswordForm(prev => ({
                            ...prev,
                            old_password: e.target.value
                          }))
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                        required
                      />
                    </label>
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      New Password
                      <input
                        type="password"
                        value={changePasswordForm.new_password}
                        onChange={(e) =>
                          setChangePasswordForm(prev => ({
                            ...prev,
                            new_password: e.target.value
                          }))
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                        required
                      />
                    </label>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="rounded-lg bg-linear-to-r from-(--color-primary) to-(--color-secondary) px-5 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {changingPassword ? "Changing password..." : "Change password"}
                    </button>
                  </div>
                </form>
              </section>

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
                        className="rounded-lg bg-linear-to-r from-(--color-primary) to-(--color-secondary) px-5 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingProfile ? "Saving..." : "Save profile"}
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
                        className="rounded-lg border border-(--color-primary) px-5 py-2 text-sm font-semibold text-(--color-primary) transition hover:bg-(--color-primary) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingPrivacy ? "Saving..." : "Save privacy settings"}
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
                              onClick={() => handleUnblockClick(entry)}
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
            <dl className="mt-3 space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <dt className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6h16M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M4 6l8 7 8-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </dt>
                <dd className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
                  <p
                    className="mt-1 max-w-[180px] truncate font-medium text-[var(--color-primary)] sm:max-w-xs"
                    title={accountEmail}
                  >
                    {accountEmail}
                  </p>
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 3v4M17 3v4M5 9h14M6 20h12a1 1 0 0 0 1-1v-8H5v8a1 1 0 0 0 1 1Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </dt>
                <dd>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Member since</p>
                  <p className="mt-1 font-medium text-gray-700">{memberSince}</p>
                </dd>
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
      <ConfirmationDialog
        isOpen={blockToUnblock !== null}
        title="Unblock User"
        message={
          blockToUnblock
            ? `Are you sure you want to unblock this user? You'll be able to see their posts again.`
            : ""
        }
        confirmText="Unblock"
        cancelText="Cancel"
        confirmVariant="default"
        onConfirm={handleUnblock}
        onCancel={() => setBlockToUnblock(null)}
      />
    </div>
  );
}
