"use client";

import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { usePaginatedResource } from "@/hooks/usePaginatedResource";
import {
  useUserSettings,
  type UserSettings,
} from "@/hooks/useUserSettings";
import type {
  BlockedUser,
  UserFilterPreference,
  UserFilterProfile,
  UserSearchResult,
} from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PasswordField } from "@/components/forms/PasswordField";
import FeedPreferencesSection from "@/components/FeedPreferencesSection";
import { usePasskey } from "@/hooks/usePasskey";
import { useDevices } from "@/hooks/useDevices";
import { useSessions } from "@/hooks/useSessions";
import { useActivityLog } from "@/hooks/useActivityLog";

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
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const SENSITIVE_CATEGORIES = [
  "Graphic violence",
  "Hate speech (non-violent)",
  "Explicit adult content",
  "Profanity",
  "Drug usage discussion",
  "Political extremism rhetoric",
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
  const [filterProfiles, setFilterProfiles] = useState<UserFilterProfile[]>([]);
  const [filterPreference, setFilterPreference] = useState<UserFilterPreference | null>(null);
  const [activeFilterProfileId, setActiveFilterProfileId] = useState<number | null>(null);
  const [filterForm, setFilterForm] = useState<{
    allow_explicit_content: boolean;
    blur_explicit_thumbnails: boolean;
    blur_thumbnails: boolean;
    age_gate: boolean;
    redact_profanity: boolean;
    category_toggles: Record<string, boolean>;
    keyword_mutes: string;
    account_mutes: string[];
  }>({
    allow_explicit_content: false,
    blur_explicit_thumbnails: false,
    blur_thumbnails: false,
    age_gate: false,
    redact_profanity: false,
    category_toggles: {},
    keyword_mutes: "",
    account_mutes: [],
  });
  const [savingFilters, setSavingFilters] = useState(false);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<UserSearchResult[]>([]);
  const [accountSearching, setAccountSearching] = useState(false);
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
  
  // Passkey management
  const {
    status: passkeyStatus,
    loading: passkeyLoading,
    error: passkeyError,
    register: registerPasskey,
    remove: removePasskey,
    refetch: refetchPasskey,
  } = usePasskey();
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  
  // Phase 2: Device and Session Management
  const { devices, loading: devicesLoading, renameDevice, removeDevice, refetch: refetchDevices } = useDevices();
  const { sessions, loading: sessionsLoading, revokeAll, refetch: refetchSessions } = useSessions();
  const { activity, loading: activityLoading, refetch: refetchActivity } = useActivityLog();
  
  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [deviceRenameValue, setDeviceRenameValue] = useState<Record<string, string>>({});

  // Auto-detect and set device name on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const detectedName = (() => {
      const ua = navigator.userAgent;
      const platform = navigator.platform;
      const vendor = navigator.vendor;
      
      // Detect mobile devices
      if (/iPhone|iPad|iPod/.test(ua)) {
        return "iPhone";
      }
      if (/Android/.test(ua)) {
        return "Android Device";
      }
      
      // Detect desktop OS
      if (/Mac/.test(platform)) {
        return "Mac";
      }
      if (/Win/.test(platform)) {
        return "Windows PC";
      }
      if (/Linux/.test(platform)) {
        return "Linux PC";
      }
      
      // Detect browser
      if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
        return "Chrome Browser";
      }
      if (/Firefox/.test(ua)) {
        return "Firefox Browser";
      }
      if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
        return "Safari Browser";
      }
      if (/Edg/.test(ua)) {
        return "Edge Browser";
      }
      
      return "This Device";
    })();
    
    setDeviceName(detectedName);
  }, []);

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
    if (!accessToken) return;
    loadModerationFilters();
  }, [accessToken]);

  useEffect(() => {
    if (!activeFilterProfileId) return;
    const active = filterProfiles.find((p) => p.id === activeFilterProfileId);
    if (!active) return;
    setFilterForm({
      allow_explicit_content: active.allow_explicit_content,
      blur_explicit_thumbnails: active.blur_explicit_thumbnails,
      blur_thumbnails: active.blur_thumbnails,
      age_gate: active.age_gate,
      redact_profanity: active.redact_profanity ?? false,
      category_toggles: active.category_toggles || {},
      keyword_mutes: (active.keyword_mutes || []).join(", "),
      account_mutes: active.account_mutes || [],
    });
  }, [activeFilterProfileId, filterProfiles]);

  const loadModerationFilters = async () => {
    if (!accessToken) return;
    setFiltersError(null);
    try {
      const [profilesResponse, preferenceResponse] = await Promise.all([
        apiGet<UserFilterProfile[]>("/moderation/filter-profiles/", {
          token: accessToken,
          cache: "no-store",
        }),
        apiGet<UserFilterPreference>("/moderation/filter-preferences/", {
          token: accessToken,
          cache: "no-store",
        }),
      ]);

      const profiles = Array.isArray(profilesResponse) ? profilesResponse : [];
      let nextProfiles = profiles;

      if (nextProfiles.length === 0) {
        const created = await apiPost<UserFilterProfile>(
          "/moderation/filter-profiles/",
          {
            name: "Default",
            is_default: true,
            category_toggles: {},
            blur_thumbnails: false,
            age_gate: false,
            allow_explicit_content: false,
            blur_explicit_thumbnails: false,
            redact_profanity: false,
            keyword_mutes: [],
            account_mutes: [],
          },
          { token: accessToken }
        );
        nextProfiles = [created];
      }

      setFilterProfiles(nextProfiles);
      setFilterPreference(preferenceResponse);

      const activeProfile = preferenceResponse?.active_profile;
      const fallbackProfile =
        activeProfile ||
        nextProfiles.find((p) => p.is_default) ||
        nextProfiles[0] ||
        null;
      setActiveFilterProfileId(fallbackProfile ? fallbackProfile.id : null);
    } catch (err) {
      console.error(err);
      setFiltersError("Unable to load filter settings.");
    }
  };

  const handleFilterProfileChange = async (profileId: number) => {
    if (!accessToken) return;
    setActiveFilterProfileId(profileId);
    try {
      const updated = await apiPost<UserFilterPreference>(
        "/moderation/filter-preferences/",
        { active_profile_id: profileId },
        { token: accessToken }
      );
      setFilterPreference(updated);
      toast.show("Active filter profile updated.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to update active profile.", "error");
    }
  };

  const handleSaveFilters = async () => {
    if (!accessToken || !activeFilterProfileId) return;
    setSavingFilters(true);
    try {
      const payload = {
        allow_explicit_content: filterForm.allow_explicit_content,
        blur_explicit_thumbnails: filterForm.blur_explicit_thumbnails,
        blur_thumbnails: filterForm.blur_thumbnails,
        age_gate: filterForm.age_gate,
        redact_profanity: filterForm.redact_profanity,
        category_toggles: filterForm.category_toggles,
        keyword_mutes: filterForm.keyword_mutes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        account_mutes: filterForm.account_mutes,
      };
      const updated = await apiPatch<UserFilterProfile>(
        `/moderation/filter-profiles/${activeFilterProfileId}/`,
        payload,
        { token: accessToken }
      );
      setFilterProfiles((prev) =>
        prev.map((profile) => (profile.id === updated.id ? updated : profile))
      );
      toast.show("Filter settings saved.");
    } catch (err) {
      console.error(err);
      toast.show("Unable to save filters.", "error");
    } finally {
      setSavingFilters(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    if (accountSearch.trim().length < 2) {
      setAccountResults([]);
      return;
    }
    const controller = new AbortController();
    const loadResults = async () => {
      setAccountSearching(true);
      try {
        const response = await apiGet<
          | { results?: UserSearchResult[] }
          | UserSearchResult[]
          | { users?: UserSearchResult[] }
        >(
          `/search/?q=${encodeURIComponent(accountSearch)}&type=user&limit=8`,
          { token: accessToken, signal: controller.signal, cache: "no-store" }
        );
        let results: UserSearchResult[] = [];
        if (Array.isArray(response)) {
          results = response;
        } else if ("results" in response) {
          results = response.results || [];
        } else if ("users" in response) {
          results = response.users || [];
        }
        setAccountResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setAccountSearching(false);
      }
    };
    const timeout = setTimeout(loadResults, 300);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [accountSearch, accessToken]);

  const addMutedAccount = (user: UserSearchResult) => {
    setFilterForm((prev) => {
      if (prev.account_mutes.includes(user.id)) return prev;
      return { ...prev, account_mutes: [...prev.account_mutes, user.id] };
    });
    setAccountSearch("");
    setAccountResults([]);
  };

  const removeMutedAccount = (userId: string) => {
    setFilterForm((prev) => ({
      ...prev,
      account_mutes: prev.account_mutes.filter((id) => id !== userId),
    }));
  };

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
              <h1 className="text-2xl font-bold --color-silver-mid">Settings</h1>
              <p className="text-sm text-gray-400">
                Manage your profile information, privacy preferences, and blocked users.
              </p>
            </div>
            <Link
              href="/app/settings/moderation"
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              Moderation history
            </Link>
          </header>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-8">
              <section className="rounded-[18px] border border-(--color-gold) bg-white/95 p-6 shadow-metallic backdrop-blur-sm">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-red-900">Change Password</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Update your password to keep your account secure.
                      </p>
                    </div>
                    <div className="rounded-full bg-(--color-deep-navy)/5 p-2 text-(--color-deep-navy) transition group-open:rotate-180">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </summary>

                  <div className="mt-6">
                    {passwordError && (
                      <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                        {passwordError}
                      </p>
                    )}

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 text-black">
                        <PasswordField
                          id="current-password"
                          label="Current Password"
                          value={changePasswordForm.old_password}
                          onChange={(value) =>
                            setChangePasswordForm(prev => ({
                              ...prev,
                              old_password: value
                            }))
                          }
                          autoComplete="current-password"

                        />
                        <PasswordField
                          id="new-password"
                          label="New Password"
                          value={changePasswordForm.new_password}
                          onChange={(value) =>
                            setChangePasswordForm(prev => ({
                              ...prev,
                              new_password: value
                            }))
                          }
                          autoComplete="new-password"
                          showMeter

                        />
                      </div>

                      {/* Password strength tip */}
                      {changePasswordForm.new_password && (
                        <p className="text-xs text-gray-600">
                          Tip: use at least 12+ chars mixing letters, numbers, and symbols for a stronger password.
                        </p>
                      )}

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="rounded-lg btn-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {changingPassword ? "Changing password..." : "Change password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </details>
              </section>

              <section className="rounded-[18px] border border-(--color-gold) bg-white/95 p-6 shadow-metallic backdrop-blur-sm">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Passkeys (WebAuthn)</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Use passkeys for passwordless authentication. More secure and convenient than passwords.
                      </p>
                    </div>
                    <div className="rounded-full bg-(--color-deep-navy)/5 p-2 text-(--color-deep-navy) transition group-open:rotate-180">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </summary>

                  <div className="mt-6">
                    {!window.PublicKeyCredential && (
                      <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                        <p className="font-semibold">WebAuthn not supported</p>
                        <p className="mt-1">
                          Your browser does not support passkeys. Please use a modern browser like Chrome, Firefox, Safari, or Edge.
                        </p>
                      </div>
                    )}

                    {passkeyError && (
                      <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                        {passkeyError}
                      </div>
                    )}

                    {passkeyStatus && passkeyStatus.has_passkey && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Registered Passkeys</h3>
                        <ul className="space-y-2">
                          {passkeyStatus.credentials.map((cred) => (
                            <li
                              key={cred.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {cred.device_name || "Unknown Device"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Added {new Date(cred.created_at).toLocaleDateString()}
                                  {cred.last_used_at && (
                                    <> • Last used {new Date(cred.last_used_at).toLocaleDateString()}</>
                                  )}
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      `Are you sure you want to remove this passkey? You won't be able to use it to sign in anymore.`
                                    )
                                  ) {
                                    try {
                                      setRemovingPasskeyId(cred.id);
                                      await removePasskey(cred.id);
                                      toast.show("Passkey removed successfully");
                                    } catch (err: any) {
                                      toast.show(err?.message || "Failed to remove passkey", "error");
                                    } finally {
                                      setRemovingPasskeyId(null);
                                    }
                                  }
                                }}
                                disabled={removingPasskeyId === cred.id || passkeyLoading}
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {removingPasskeyId === cred.id ? "Removing..." : "Remove"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Device Nickname
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          A friendly name to identify this device (e.g., "My iPhone", "Work Laptop")
                        </p>
                        <input
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          placeholder="e.g., My iPhone, Work Laptop"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-(--color-gold) focus:ring-2 focus:ring-(--color-deep-navy)/20 placeholder:text-gray-400"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!window.PublicKeyCredential) {
                            toast.show("Passkeys are not supported in your browser", "error");
                            return;
                          }

                          try {
                            setRegisteringPasskey(true);
                            await registerPasskey(deviceName.trim() || undefined);
                            setDeviceName("");
                            toast.show("Passkey registered successfully! You can now use it to sign in.");
                            await refetchPasskey();
                          } catch (err: any) {
                            toast.show(
                              err?.message || "Failed to register passkey. Please try again.",
                              "error"
                            );
                          } finally {
                            setRegisteringPasskey(false);
                          }
                        }}
                        disabled={registeringPasskey || passkeyLoading || !window.PublicKeyCredential}
                        className="w-full rounded-lg btn-primary px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {registeringPasskey ? "Registering..." : passkeyStatus?.has_passkey ? "Add Another Passkey" : "Enable Passkey"}
                      </button>
                    </div>

                    {passkeyStatus && passkeyStatus.has_passkey && (
                      <p className="mt-4 text-xs text-gray-500">
                        You can use any of your registered passkeys to sign in without a password.
                      </p>
                    )}
                  </div>
                </details>
              </section>

              {/* Phase 2: Security & Sessions */}
              <section className="rounded-[18px] border border-(--color-gold) bg-white/95 p-6 shadow-metallic backdrop-blur-sm">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Security & Sessions</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Manage your devices, active sessions, and view your login activity.
                      </p>
                    </div>
                    <div className="rounded-full bg-(--color-deep-navy)/5 p-2 text-(--color-deep-navy) transition group-open:rotate-180">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </summary>

                  <div className="mt-6 space-y-6">
                    {/* Devices Section */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Devices</h3>
                      {devicesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner />
                        </div>
                      ) : devices.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">No devices registered yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {devices.map((device) => (
                            <li
                              key={device.id}
                              className="rounded-lg border border-gray-200 bg-white p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {renamingDeviceId === device.id ? (
                                      <input
                                        type="text"
                                        value={deviceRenameValue[device.id] || device.device_name}
                                        onChange={(e) =>
                                          setDeviceRenameValue({ ...deviceRenameValue, [device.id]: e.target.value })
                                        }
                                        onBlur={async () => {
                                          const newName = deviceRenameValue[device.id]?.trim();
                                          if (newName && newName !== device.device_name) {
                                            try {
                                              await renameDevice(device.id, newName);
                                              toast.show("Device renamed");
                                            } catch (err: any) {
                                              toast.show(err?.message || "Failed to rename device", "error");
                                            }
                                          }
                                          setRenamingDeviceId(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                          } else if (e.key === "Escape") {
                                            setRenamingDeviceId(null);
                                            setDeviceRenameValue({ ...deviceRenameValue, [device.id]: device.device_name });
                                          }
                                        }}
                                        autoFocus
                                        className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1"
                                      />
                                    ) : (
                                      <>
                                        <p className="text-sm font-medium text-gray-900">
                                          {device.device_name || "Unknown Device"}
                                        </p>
                                        <button
                                          onClick={() => {
                                            setRenamingDeviceId(device.id);
                                            setDeviceRenameValue({ ...deviceRenameValue, [device.id]: device.device_name });
                                          }}
                                          className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                          Rename
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-0.5">
                                    {device.location && <p>📍 {device.location}</p>}
                                    {device.last_seen_location && device.last_seen_location !== device.location && (
                                      <p>Last seen: {device.last_seen_location}</p>
                                    )}
                                    <p>
                                      Added {new Date(device.created_at).toLocaleDateString()}
                                      {device.last_used_at && (
                                        <> • Last used {new Date(device.last_used_at).toLocaleDateString()}</>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `Are you sure you want to remove this device? You won't be able to use it to sign in anymore.`
                                      )
                                    ) {
                                      try {
                                        setRemovingDeviceId(device.id);
                                        await removeDevice(device.id);
                                        toast.show("Device removed successfully");
                                        await refetchDevices();
                                      } catch (err: any) {
                                        toast.show(err?.message || "Failed to remove device", "error");
                                      } finally {
                                        setRemovingDeviceId(null);
                                      }
                                    }
                                  }}
                                  disabled={removingDeviceId === device.id}
                                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {removingDeviceId === device.id ? "Removing..." : "Remove"}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Active Sessions Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">Active Sessions</h3>
                        {sessions.length > 0 && (
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  "Are you sure you want to sign out of all other devices? You'll remain signed in on this device."
                                )
                              ) {
                                try {
                                  setRevokingSessions(true);
                                  await revokeAll();
                                  toast.show("All other sessions revoked");
                                  await refetchSessions();
                                } catch (err: any) {
                                  toast.show(err?.message || "Failed to revoke sessions", "error");
                                } finally {
                                  setRevokingSessions(false);
                                }
                              }
                            }}
                            disabled={revokingSessions}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                          >
                            {revokingSessions ? "Revoking..." : "Sign out of all other devices"}
                          </button>
                        )}
                      </div>
                      {sessionsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Spinner />
                        </div>
                      ) : sessions.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">No active sessions.</p>
                      ) : (
                        <ul className="space-y-2">
                          {sessions.map((session) => (
                            <li
                              key={session.id}
                              className="rounded-lg border border-gray-200 bg-white p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    {session.device_name || "Unknown Device"}
                                    {session.is_current && (
                                      <span className="ml-2 text-xs text-green-600 font-normal">(Current)</span>
                                    )}
                                  </p>
                                  <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                                    {session.location && <p>📍 {session.location}</p>}
                                    <p>Last activity: {new Date(session.last_activity).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Activity Log Section */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Login Activity</h3>
                      {activityLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Spinner />
                        </div>
                      ) : activity.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">No activity recorded.</p>
                      ) : (
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                          {activity.map((entry) => (
                            <li
                              key={entry.id}
                              className="rounded-lg border border-gray-200 bg-white p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                      {entry.authentication_method === "passkey" ? "🔐 Passkey" : "🔑 Password"}
                                    </span>
                                    <p className="text-sm font-medium text-gray-900">
                                      {entry.device_name || "Unknown Device"}
                                    </p>
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-0.5">
                                    {entry.location && <p>📍 {entry.location}</p>}
                                    <p>{new Date(entry.created_at).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </details>
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
                        className="mt-1 rounded-lg border border-(--color-silver-light) px-3 py-2 text-sm outline-none transition focus:border-(--color-gold) focus:ring-2 focus:ring-(--color-deep-navy)/20"
                      />
                    </label>
                    <label className="flex flex-col text-sm font-medium text-gray-700">
                      Last name
                      <input
                        value={profileForm.last_name}
                        onChange={(e) =>
                          handleProfileChange("last_name", e.target.value)
                        }
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                      className="rounded-lg btn-primary px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
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
                      className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPrivacy ? "Saving..." : "Save privacy settings"}
                    </button>
                  </div>
                </form>
              </section>

              <FeedPreferencesSection />

              <section className="rounded-[18px] border border-gray-100 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Content filters</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Customize what you see by adjusting sensitive content settings.
                    </p>
                  </div>
                  <button
                    onClick={() => loadModerationFilters()}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                  >
                    Refresh
                  </button>
                </div>

                {filtersError && (
                  <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {filtersError}
                  </p>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm font-medium text-gray-700">
                    Active filter profile
                    <select
                      value={activeFilterProfileId ?? ""}
                      onChange={(e) => handleFilterProfileChange(Number(e.target.value))}
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--color-deep-navy)] focus:ring-2 focus:ring-[var(--color-deep-navy)]/20"
                    >
                      {filterProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                          {profile.is_default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterForm.allow_explicit_content}
                      onChange={(e) =>
                        setFilterForm((prev) => ({
                          ...prev,
                          allow_explicit_content: e.target.checked,
                        }))
                      }
                    />
                    Allow explicit content
                  </label>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterForm.redact_profanity}
                      onChange={(e) =>
                        setFilterForm((prev) => ({
                          ...prev,
                          redact_profanity: e.target.checked,
                        }))
                      }
                    />
                    Redact profanity in text
                  </label>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterForm.blur_explicit_thumbnails}
                      onChange={(e) =>
                        setFilterForm((prev) => ({
                          ...prev,
                          blur_explicit_thumbnails: e.target.checked,
                        }))
                      }
                    />
                    Blur explicit media thumbnails
                  </label>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterForm.blur_thumbnails}
                      onChange={(e) =>
                        setFilterForm((prev) => ({
                          ...prev,
                          blur_thumbnails: e.target.checked,
                        }))
                      }
                    />
                    Blur sensitive thumbnails
                  </label>
                  <label className="flex items-center gap-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterForm.age_gate}
                      onChange={(e) =>
                        setFilterForm((prev) => ({
                          ...prev,
                          age_gate: e.target.checked,
                        }))
                      }
                    />
                    Enable age gating
                  </label>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800">Sensitive categories</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SENSITIVE_CATEGORIES.map((label) => {
                      const value = filterForm.category_toggles[label];
                      const isEnabled = value !== false;
                      return (
                        <label key={label} className="flex items-center gap-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) =>
                              setFilterForm((prev) => ({
                                ...prev,
                                category_toggles: {
                                  ...prev.category_toggles,
                                  [label]: e.target.checked,
                                },
                              }))
                            }
                          />
                          Show {label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm font-medium text-gray-700">
                    Keyword mutes (comma separated)
                    <input
                      value={filterForm.keyword_mutes}
                      onChange={(e) =>
                        setFilterForm((prev) => ({ ...prev, keyword_mutes: e.target.value }))
                      }
                      className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="spoilers, politics"
                    />
                  </label>
                  <div className="flex flex-col text-sm font-medium text-gray-700">
                    Mute accounts
                    <div className="relative mt-1">
                      <input
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Search users to mute"
                      />
                      {accountSearch.trim().length >= 2 && (
                        <div className="absolute z-10 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                          {accountSearching ? (
                            <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
                          ) : accountResults.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500">No users found.</div>
                          ) : (
                            accountResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => addMutedAccount(user)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                <span className="font-semibold text-gray-800">{user.title}</span>
                                <span className="text-xs text-gray-500">{user.id.slice(0, 8)}…</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {filterForm.account_mutes.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {filterForm.account_mutes.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                          >
                            {id.slice(0, 8)}…
                            <button
                              type="button"
                              onClick={() => removeMutedAccount(id)}
                              className="text-gray-500 hover:text-gray-800"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">No muted accounts yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleSaveFilters}
                    disabled={savingFilters}
                    className="rounded-lg border border-(--color-deep-navy) px-5 py-2 text-sm font-semibold text-(--color-deep-navy) transition hover:bg-(--color-deep-navy) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingFilters ? "Saving..." : "Save filter settings"}
                  </button>
                </div>
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
                      className="rounded-lg border border-[var(--color-deep-navy)] px-4 py-2 text-xs font-semibold text-[var(--color-deep-navy)] transition hover:bg-[var(--color-deep-navy)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-[18px] border border-(--color-gold) bg-white/95 p-6 shadow-metallic backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-gray-900">Account</h2>
            <dl className="mt-3 space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <dt className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-deep-navy)/10 text-(--color-deep-navy)">
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
                    className="mt-1 max-w-[180px] truncate font-medium text-[var(--color-deep-navy)] sm:max-w-xs"
                    title={accountEmail}
                  >
                    {accountEmail}
                  </p>
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-rich-red-top)]/10 text-[var(--color-rich-red-top)]">
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
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-deep-navy)] hover:opacity-80"
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
