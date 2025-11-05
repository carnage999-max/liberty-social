import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { FriendRequest, PaginatedResponse, User } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import UserProfileBottomSheet from '../../components/profile/UserProfileBottomSheet';

type Tab = 'incoming' | 'outgoing' | 'all';

interface FriendRequestWithUser extends FriendRequest {
  from_user?: User;
  to_user?: User;
}

export default function FriendRequestsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('incoming');
  const [requests, setRequests] = useState<FriendRequestWithUser[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [sendingRequest, setSendingRequest] = useState<string | number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [profileBottomSheetVisible, setProfileBottomSheetVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);

  const loadFriendRequests = useCallback(async () => {
    try {
      setLoading(true);
      const query = activeTab === 'all' ? {} : { direction: activeTab };
      const response = await apiClient.get<PaginatedResponse<FriendRequestWithUser>>(
        '/auth/friend-requests/',
        { params: query }
      );
      setRequests(response.results || []);
      setNext(response.next);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      Alert.alert('Error', 'Failed to load friend requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<User>>('/auth/friends/suggestions/');
      const results = (response as any)?.results ?? (Array.isArray(response) ? response : []);
      setSuggestions(Array.isArray(results) ? results.slice(0, 12) : []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    loadFriendRequests();
    loadSuggestions();
  }, [loadFriendRequests, loadSuggestions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFriendRequests();
    loadSuggestions();
  };

  const handleAction = async (requestId: number, action: 'accept' | 'decline' | 'cancel') => {
    try {
      setActionLoading(requestId);
      const suffix =
        action === 'accept'
          ? 'accept-friend-request'
          : action === 'decline'
          ? 'decline'
          : 'cancel';
      await apiClient.post(`/auth/friend-requests/${requestId}/${suffix}/`);
      
      const message =
        action === 'accept'
          ? 'Friend request accepted.'
          : action === 'decline'
          ? 'Friend request declined.'
          : 'Friend request cancelled.';
      Alert.alert('Success', message);
      
      await loadFriendRequests();
      await loadSuggestions(); // Refresh suggestions after action
    } catch (error) {
      console.error('Error handling friend request:', error);
      Alert.alert('Error', 'Failed to process friend request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRequest = async (userId: string | number) => {
    try {
      setSendingRequest(userId);
      await apiClient.post('/auth/friend-requests/', {
        to_user: String(userId),
      });
      Alert.alert('Success', 'Friend request sent.');
      await loadSuggestions(); // Remove from suggestions after sending
      await loadFriendRequests(); // Refresh to show in sent tab
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const renderRequest = ({ item }: { item: FriendRequestWithUser }) => {
    const isIncoming = item.to_user?.id === user?.id;
    const peer = isIncoming ? item.from_user : item.to_user;
    
    const displayName = peer?.username ||
      `${peer?.first_name || ''} ${peer?.last_name || ''}`.trim() ||
      peer?.email ||
      'User';

    const avatarUri = peer?.profile_image_url
      ? resolveRemoteUrl(peer.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    return (
      <View
        style={[
          styles.requestContainer,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.requestUserInfo}
          onPress={() => {
            if (peer?.id) {
              setSelectedUserId(peer.id);
              setProfileBottomSheetVisible(true);
            }
          }}
        >
          <Image source={avatarSource} style={styles.requestAvatar} />
          <View style={styles.requestInfo}>
            <Text style={[styles.requestName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.requestStatus, { color: colors.textSecondary }]}>
              {isIncoming ? 'Requested to connect with you' : 'Sent by you'}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.requestActions}>
          {isIncoming ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAction(item.id, 'accept')}
                disabled={actionLoading === item.id}
              >
                <Text style={styles.actionButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleAction(item.id, 'decline')}
                disabled={actionLoading === item.id}
              >
                <Text style={[styles.actionButtonText, styles.declineButtonText]}>Decline</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleAction(item.id, 'cancel')}
              disabled={actionLoading === item.id}
            >
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSuggestion = ({ item }: { item: User }) => {
    const displayName = item.username ||
      `${item.first_name || ''} ${item.last_name || ''}`.trim() ||
      item.email ||
      'User';

    const avatarUri = item.profile_image_url
      ? resolveRemoteUrl(item.profile_image_url)
      : null;
    const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

    const isSending = sendingRequest === item.id;

    return (
      <View
        style={[
          styles.suggestionContainer,
          {
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.suggestionUserInfo}
          onPress={() => {
            setSelectedUserId(item.id);
            setProfileBottomSheetVisible(true);
          }}
        >
          <Image source={avatarSource} style={styles.suggestionAvatar} />
          <View style={styles.suggestionInfo}>
            <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {item.username && (
              <Text style={[styles.suggestionUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendRequestButton, { backgroundColor: colors.primary }]}
          onPress={() => handleSendRequest(item.id)}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendRequestButtonText}>Send Request</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    countContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    countText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    requestContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    requestUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    requestAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    requestStatus: {
      fontSize: 12,
    },
    requestActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 70,
      alignItems: 'center',
    },
    acceptButton: {
      backgroundColor: colors.primary,
    },
    declineButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#FF4D4F',
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    declineButtonText: {
      color: colors.text,
    },
    cancelButtonText: {
      color: '#FF4D4F',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    suggestionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    suggestionUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    suggestionAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    suggestionInfo: {
      flex: 1,
    },
    suggestionName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    suggestionUsername: {
      fontSize: 13,
    },
    sendRequestButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendRequestButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  }), [colors, isDark]);

  if (loading && requests.length === 0) {
    return (
      <View style={styles.container}>
        <AppNavbar title="Friend Requests" showLogo={false} showProfileImage={false} showBackButton={true} onBackPress={() => router.push('/(tabs)/friends')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Friend Requests" 
        showLogo={false} 
        showProfileImage={false} 
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/friends')}
      />

      <View style={styles.tabsContainer}>
        {(['incoming', 'outgoing', 'all'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'incoming' ? 'Incoming' : tab === 'outgoing' ? 'Sent' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {requests.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          </Text>
        </View>
      )}

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="person-add-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {activeTab === 'incoming' 
                ? 'No incoming requests' 
                : activeTab === 'outgoing' 
                ? 'No sent requests' 
                : 'No friend requests'}
            </Text>
          </View>
        }
        ListFooterComponent={
          suggestions.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>People You May Know</Text>
              </View>
              {suggestions.map((item) => (
                <View key={`suggestion-${item.id}`}>
                  {renderSuggestion({ item })}
                </View>
              ))}
            </>
          ) : null
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
      />

      <UserProfileBottomSheet
        visible={profileBottomSheetVisible}
        userId={selectedUserId}
        onClose={() => {
          setProfileBottomSheetVisible(false);
          setSelectedUserId(null);
        }}
      />
    </View>
  );
}

