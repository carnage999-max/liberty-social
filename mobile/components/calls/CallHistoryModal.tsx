import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { apiClient } from '../../utils/api';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';

interface Call {
  id: number;
  caller: any;
  receiver: any;
  call_type: 'voice' | 'video';
  status: string;
  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
}

export default function CallHistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void; }) {
  const { colors, isDark } = useTheme();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [grouped, setGrouped] = useState<Array<{ title: string; data: Call[] }>>([]);

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<{ results: Call[] }>('/calls/?ordering=-started_at');
        const results = data.results || [];
        setCalls(results);
      } catch (err) {
        console.error('Failed loading calls', err);
        setCalls([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [visible]);

  useEffect(() => {
    const groupedMap: Record<string, Call[]> = {};
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    calls.forEach((c) => {
      const d = new Date(c.started_at);
      let key = d.toLocaleDateString();
      if (d.toDateString() === today.toDateString()) key = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday';
      if (!groupedMap[key]) groupedMap[key] = [];
      groupedMap[key].push(c);
    });

    const sections = Object.keys(groupedMap).map((k) => ({ title: k, data: groupedMap[k] }));
    sections.sort((a, b) => {
      if (a.title === 'Today') return -1;
      if (b.title === 'Today') return 1;
      if (a.title === 'Yesterday') return -1;
      if (b.title === 'Yesterday') return 1;
      return new Date(groupedMap[b.title][0].started_at).getTime() - new Date(groupedMap[a.title][0].started_at).getTime();
    });

    setGrouped(sections);
  }, [calls]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  const formatDuration = (secs?: number | null) => {
    if (!secs) return 'Not connected';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderCall = ({ item }: { item: Call }) => {
    const otherUser = item.caller && item.receiver ? (String(item.caller.id) === String(item.caller.id) ? item.receiver : item.receiver) : (item.caller || item.receiver);
    const name = otherUser?.first_name && otherUser?.last_name ? `${otherUser.first_name} ${otherUser.last_name}` : otherUser?.username || 'Unknown';
    const avatar = otherUser?.profile_image_url ? { uri: resolveRemoteUrl(otherUser.profile_image_url) } : DEFAULT_AVATAR;

    const isAnswered = !!item.answered_at;
    let statusText = '';
    if (!isAnswered && item.status && item.status !== 'initiating') {
      if (/missed|no answer/i.test(item.status) || item.status === 'missed') statusText = 'Missed';
      else if (item.status === 'rejected' || /rejected|declined/i.test(item.status)) statusText = 'Declined';
      else statusText = item.status;
    } else if (isAnswered) {
      statusText = formatDuration(item.duration_seconds || 0);
    } else {
      statusText = item.status;
    }

    const iconName = item.call_type === 'video' ? 'videocam' : 'call';
    const iconColor = !isAnswered ? '#DC2626' : '#10B981';

    return (
      <View style={[localStyles.callRow, { borderBottomColor: colors.border }] }>
        <Image source={avatar} style={localStyles.callAvatar} />
        <View style={localStyles.callInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={iconName as any} size={16} color={iconColor} />
            <Text style={[localStyles.callName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          </View>
          <Text style={[localStyles.callMeta, { color: colors.textSecondary }]}>{formatTime(item.started_at)} • {statusText}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[localStyles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }]}>
        <View style={[localStyles.container, { backgroundColor: colors.background }]}>
          <View style={[localStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[localStyles.title, { color: colors.text }]}>Call History</Text>
            <TouchableOpacity onPress={onClose} style={localStyles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : grouped.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="call" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No call history</Text>
            </View>
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={(s) => s.title}
              renderItem={({ item: section }) => (
                <View>
                  <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
                  <FlatList
                    data={section.data}
                    keyExtractor={(c) => String(c.id)}
                    renderItem={renderCall}
                  />
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '94%',
    maxHeight: '86%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 10,
  },
  sectionTitle: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  callAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '600',
  },
  callMeta: {
    fontSize: 13,
  },
});
