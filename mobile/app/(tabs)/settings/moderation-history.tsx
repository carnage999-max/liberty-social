import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAlert } from '../../../contexts/AlertContext';
import { apiClient } from '../../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import type { PaginatedResponse } from '../../../types';

type ModerationAction = {
  id: number;
  content_type: { app_label: string; model: string } | null;
  object_id: string | null;
  layer: string;
  action: string;
  reason_code: string;
  rule_ref: string;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function ModerationHistoryScreen() {
  const { colors, isDark } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  const [items, setItems] = useState<ModerationAction[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadActions = useCallback(
    async (pageNumber: number, replace: boolean) => {
      try {
        const data = await apiClient.get<PaginatedResponse<ModerationAction>>(
          `/moderation/actions/?page=${pageNumber}&page_size=${PAGE_SIZE}`
        );
        const results = data?.results || [];
        setItems((prev) => (replace ? results : [...prev, ...results]));
        setHasMore(!!data?.next);
      } catch (error) {
        console.error('Failed to load moderation history', error);
        showError('Unable to load moderation history.');
      }
    },
    [showError]
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadActions(1, true);
      setPage(1);
      setLoading(false);
    };
    init();
  }, [loadActions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActions(1, true);
    setPage(1);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    await loadActions(nextPage, false);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const renderItem = ({ item }: { item: ModerationAction }) => {
    const contentLabel = item.content_type?.model || 'content';
    const objectId = item.object_id || 'n/a';

    return (
      <View style={[styles.card, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {item.layer} · {item.action} · {item.reason_code}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
          {contentLabel} #{objectId}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppNavbar
        title="Moderation History"
        showLogo={false}
        showProfileImage={false}
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/settings')}
      />

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No moderation actions yet.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <Text style={[styles.loadingMore, { color: colors.textSecondary }]}>Loading more…</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
  },
  emptyContainer: {
    paddingTop: 64,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingMore: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
  },
});
