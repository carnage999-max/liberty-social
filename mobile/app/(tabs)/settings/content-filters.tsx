import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAlert } from '../../../contexts/AlertContext';
import { apiClient } from '../../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';

type UserFilterProfile = {
  id: number;
  name: string;
  is_default: boolean;
  category_toggles: Record<string, boolean>;
  blur_thumbnails: boolean;
  age_gate: boolean;
  allow_explicit_content: boolean;
  blur_explicit_thumbnails: boolean;
  redact_profanity: boolean;
  keyword_mutes: string[];
  account_mutes: string[];
};

type UserFilterPreference = {
  id: number;
  active_profile: UserFilterProfile | null;
  updated_at: string;
};

type UserSearchResult = {
  id: string;
  title: string;
  description?: string | null;
};

const SENSITIVE_CATEGORIES = [
  'Graphic violence',
  'Hate speech (non-violent)',
  'Explicit adult content',
  'Profanity',
  'Drug usage discussion',
  'Political extremism rhetoric',
];

export default function ContentFiltersScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<UserFilterProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFilterProfile | null>(null);
  const [keywordMutesInput, setKeywordMutesInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const loadFilters = async () => {
    try {
      setLoading(true);
      const [profilesResponse, preferenceResponse] = await Promise.all([
        apiClient.get<UserFilterProfile[] | { results?: UserFilterProfile[] }>('/moderation/filter-profiles/'),
        apiClient.get<UserFilterPreference>('/moderation/filter-preferences/'),
      ]);
      const list = Array.isArray(profilesResponse)
        ? profilesResponse
        : Array.isArray(profilesResponse?.results)
        ? profilesResponse.results
        : [];
      let nextProfiles = list;
      if (nextProfiles.length === 0) {
        const created = await apiClient.post<UserFilterProfile>('/moderation/filter-profiles/', {
          name: 'Default',
          is_default: true,
          category_toggles: {},
          blur_thumbnails: false,
          age_gate: false,
          allow_explicit_content: false,
          blur_explicit_thumbnails: false,
          redact_profanity: false,
          keyword_mutes: [],
          account_mutes: [],
        });
        nextProfiles = [created];
      }
      const active = preferenceResponse?.active_profile;
      const fallback = active || nextProfiles.find((p) => p.is_default) || nextProfiles[0] || null;
      setProfiles(nextProfiles);
      setActiveProfileId(fallback ? fallback.id : null);
      setForm(fallback || null);
      setKeywordMutesInput((fallback?.keyword_mutes || []).join(', '));
    } catch (error) {
      console.error(error);
      showError('Failed to load filters');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      setSearching(true);
      const response = await apiClient.get<{ users?: UserSearchResult[] }>(
        `/search/?q=${encodeURIComponent(query)}&type=user&limit=6`
      );
      setSearchResults(response?.users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const addMutedAccount = (user: UserSearchResult) => {
    if (!form) return;
    if (form.account_mutes.includes(user.id)) return;
    setForm({ ...form, account_mutes: [...form.account_mutes, user.id] });
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMutedAccount = (userId: string) => {
    if (!form) return;
    setForm({
      ...form,
      account_mutes: form.account_mutes.filter((id) => id !== userId),
    });
  };

  const saveFilters = async () => {
    if (!form || !activeProfileId) return;
    try {
      setSaving(true);
      const payload = {
        allow_explicit_content: form.allow_explicit_content,
        blur_explicit_thumbnails: form.blur_explicit_thumbnails,
        blur_thumbnails: form.blur_thumbnails,
        age_gate: form.age_gate,
        redact_profanity: form.redact_profanity,
        category_toggles: form.category_toggles,
        keyword_mutes: keywordMutesInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        account_mutes: form.account_mutes,
      };
      const updated = await apiClient.patch<UserFilterProfile>(
        `/moderation/filter-profiles/${activeProfileId}/`,
        payload
      );
      setForm(updated);
      setKeywordMutesInput((updated.keyword_mutes || []).join(', '));
      showSuccess('Filters saved');
    } catch (error) {
      console.error(error);
      showError('Failed to save filters');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppNavbar
          title="Content Filters"
          showLogo={false}
          showProfileImage={false}
          showBackButton={true}
          onBackPress={() => router.push('/(tabs)/settings')}
        />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <AppNavbar
        title="Content Filters"
        showLogo={false}
        showProfileImage={false}
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/settings')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sensitive content</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <ToggleRow
            label="Allow explicit content"
            value={form.allow_explicit_content}
            onToggle={(value) => setForm({ ...form, allow_explicit_content: value })}
          />
          <ToggleRow
            label="Redact profanity in text"
            value={form.redact_profanity}
            onToggle={(value) => setForm({ ...form, redact_profanity: value })}
          />
          <ToggleRow
            label="Blur explicit thumbnails"
            value={form.blur_explicit_thumbnails}
            onToggle={(value) => setForm({ ...form, blur_explicit_thumbnails: value })}
          />
          <ToggleRow
            label="Blur sensitive thumbnails"
            value={form.blur_thumbnails}
            onToggle={(value) => setForm({ ...form, blur_thumbnails: value })}
          />
          <ToggleRow
            label="Enable age gate"
            value={form.age_gate}
            onToggle={(value) => setForm({ ...form, age_gate: value })}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sensitive categories</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          {SENSITIVE_CATEGORIES.map((label) => {
            const enabled = form.category_toggles[label] !== false;
            return (
              <ToggleRow
                key={label}
                label={`Show ${label}`}
                value={enabled}
                onToggle={(value) =>
                  setForm({
                    ...form,
                    category_toggles: { ...form.category_toggles, [label]: value },
                  })
                }
              />
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Keyword mutes</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="spoilers, politics"
            placeholderTextColor={colors.textSecondary}
            value={keywordMutesInput}
            onChangeText={setKeywordMutesInput}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Muted accounts</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Search users to mute"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searching ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>Searching…</Text>
          ) : searchResults.length > 0 ? (
            <View style={styles.searchResults}>
              {searchResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  onPress={() => addMutedAccount(user)}
                  style={styles.searchResultRow}
                >
                  <Text style={[styles.searchResultName, { color: colors.text }]}>
                    {user.title}
                  </Text>
                  <Text style={[styles.searchResultId, { color: colors.textSecondary }]}>
                    {user.id.slice(0, 8)}…
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {form.account_mutes.length === 0 ? (
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              No muted accounts yet.
            </Text>
          ) : (
            <View style={styles.mutedList}>
              {form.account_mutes.map((id) => (
                <View key={id} style={[styles.mutedChip, { borderColor: colors.border }]}>
                  <Text style={[styles.mutedChipText, { color: colors.text }]}>
                    {id.slice(0, 8)}…
                  </Text>
                  <TouchableOpacity onPress={() => removeMutedAccount(id)}>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={saveFilters}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryActionText}>Save Filters</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => onToggle(!value)}
        style={[
          styles.toggleSwitch,
          { backgroundColor: value ? colors.primary : colors.border },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            { backgroundColor: '#fff', alignSelf: value ? 'flex-end' : 'flex-start' },
          ]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
  },
  searchResults: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchResultRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultId: {
    fontSize: 12,
  },
  mutedList: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mutedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mutedChipText: {
    fontSize: 12,
  },
  primaryActionButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#192A4A',
    borderWidth: 1,
    borderColor: '#C8A25F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
