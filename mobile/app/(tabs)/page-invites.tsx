import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import { LinearGradient } from 'expo-linear-gradient';

interface PageInvite {
  id: number;
  page: {
    id: number;
    name: string;
    category: string;
    profile_image_url?: string;
  };
  sender: {
    id: string;
    username: string;
    email: string;
    profile_image_url?: string;
  };
  recipient: {
    id: string;
    username: string;
    email: string;
    profile_image_url?: string;
  };
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export default function PageInvitesScreen() {
  const { colors, isDark } = useTheme();
  const { accessToken } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [invites, setInvites] = useState<PageInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<PageInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'sent'>('pending');

  useEffect(() => {
    if (accessToken) {
      loadInvites();
    }
  }, [accessToken]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const [receivedResponse, sentResponse] = await Promise.all([
        apiClient.get<PageInvite[]>('/page-invites/'),
        apiClient.get<PageInvite[]>('/page-invites/sent/'),
      ]);
      
      const receivedList = Array.isArray(receivedResponse) ? receivedResponse : receivedResponse?.results || [];
      const sentList = Array.isArray(sentResponse) ? sentResponse : sentResponse?.results || [];
      
      setInvites(receivedList);
      setSentInvites(sentList);
    } catch (error) {
      console.error('Failed to load invites:', error);
      showError('Failed to load invites');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (inviteId: number) => {
    try {
      setProcessingId(inviteId);
      await apiClient.post(`/page-invites/${inviteId}/accept/`, {});
      showSuccess('You are now following this page!');
      setInvites(prev => prev.map(inv => 
        inv.id === inviteId ? { ...inv, status: 'accepted' } : inv
      ));
    } catch (error) {
      console.error('Failed to accept invite:', error);
      showError('Failed to accept invite');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (inviteId: number) => {
    try {
      setProcessingId(inviteId);
      await apiClient.post(`/page-invites/${inviteId}/decline/`, {});
      showSuccess('Invite declined');
      setInvites(prev => prev.map(inv => 
        inv.id === inviteId ? { ...inv, status: 'declined' } : inv
      ));
    } catch (error) {
      console.error('Failed to decline invite:', error);
      showError('Failed to decline invite');
    } finally {
      setProcessingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInvites();
  };

  const pendingInvites = invites.filter(inv => inv.status === 'pending');
  const acceptedInvites = invites.filter(inv => inv.status === 'accepted');
  const declinedInvites = invites.filter(inv => inv.status === 'declined');

  const renderInvite = ({ item }: { item: PageInvite }) => {
    const displayName = item.sender.username || item.sender.email;
    const avatarUri = item.sender.profile_image_url
      ? resolveRemoteUrl(item.sender.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    const pageAvatarUri = item.page.profile_image_url
      ? resolveRemoteUrl(item.page.profile_image_url)
      : null;
    const pageAvatarSource = pageAvatarUri ? { uri: pageAvatarUri } : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[
          styles.inviteCard,
          { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderColor: colors.border },
        ]}
        onPress={() => router.push(`/pages/${item.page.id}`)}
        activeOpacity={0.7}
      >
        <Image source={pageAvatarSource} style={styles.pageAvatar} />
        <View style={styles.inviteContent}>
          <Text style={[styles.pageName, { color: colors.text }]} numberOfLines={1}>
            {item.page.name}
          </Text>
          <Text style={[styles.pageCategory, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.page.category}
          </Text>
          <View style={styles.senderInfo}>
            <Image source={avatarSource} style={styles.senderAvatar} />
            <Text style={[styles.senderText, { color: colors.textSecondary }]}>
              Invited by {displayName}
            </Text>
          </View>
        </View>
        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.declineButton, { borderColor: colors.border }]}
              onPress={() => handleDecline(item.id)}
              disabled={processingId === item.id}
            >
              <Text style={[styles.declineButtonText, { color: colors.text }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item.id)}
              disabled={processingId === item.id}
            >
              <LinearGradient
                colors={['#192A4A', '#1a2335']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptButtonGradient}
              >
                {processingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'accepted' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Accepted</Text>
          </View>
        )}
        {item.status === 'declined' && (
          <View style={[styles.statusBadge, styles.statusBadgeDeclined]}>
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextDeclined]}>Declined</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSentInvite = ({ item }: { item: PageInvite }) => {
    const displayName = item.recipient.username || item.recipient.email;
    const avatarUri = item.recipient.profile_image_url
      ? resolveRemoteUrl(item.recipient.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    const pageAvatarUri = item.page.profile_image_url
      ? resolveRemoteUrl(item.page.profile_image_url)
      : null;
    const pageAvatarSource = pageAvatarUri ? { uri: pageAvatarUri } : DEFAULT_AVATAR;

    const getStatusColor = () => {
      switch (item.status) {
        case 'accepted':
          return '#10B981';
        case 'declined':
          return '#EF4444';
        default:
          return '#F59E0B';
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.inviteCard,
          { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderColor: colors.border },
        ]}
        onPress={() => router.push(`/pages/${item.page.id}`)}
        activeOpacity={0.7}
      >
        <Image source={pageAvatarSource} style={styles.pageAvatar} />
        <View style={styles.inviteContent}>
          <Text style={[styles.pageName, { color: colors.text }]} numberOfLines={1}>
            {item.page.name}
          </Text>
          <Text style={[styles.pageCategory, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.page.category}
          </Text>
          <View style={styles.senderInfo}>
            <Image source={avatarSource} style={styles.senderAvatar} />
            <Text style={[styles.senderText, { color: colors.textSecondary }]}>
              Sent to {displayName}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppNavbar title="Page Invites" showProfileImage={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C8A25F" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppNavbar title="Page Invites" showProfileImage={false} />
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Received ({pendingInvites.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent ({sentInvites.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'pending' ? (
        <>
          {pendingInvites.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending</Text>
            </View>
          )}
          <FlatList
            data={pendingInvites}
            renderItem={renderInvite}
            keyExtractor={(item) => `pending-${item.id}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A25F" />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="mail-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending invites
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        <FlatList
          data={sentInvites}
          renderItem={renderSentInvite}
          keyExtractor={(item) => `sent-${item.id}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A25F" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="send-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No sent invites
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#C8A25F',
    backgroundColor: '#192A4A',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#C8A25F',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabTextActive: {
    color: '#C8A25F',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pageAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
  },
  inviteContent: {
    flex: 1,
  },
  pageName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageCategory: {
    fontSize: 13,
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  senderText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C8A25F',
  },
  acceptButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#10B98120',
  },
  statusBadgeDeclined: {
    backgroundColor: '#EF444420',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  statusBadgeTextDeclined: {
    color: '#EF4444',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});

