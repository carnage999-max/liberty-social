import React, { useMemo, ReactNode, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../utils/url';
import { Ionicons } from '@expo/vector-icons';
import SearchModal from '../SearchModal';

interface AppNavbarProps {
  title?: string;
  showLogo?: boolean;
  showProfileImage?: boolean;
  showSettingsIcon?: boolean;
  showBackButton?: boolean;
  showMessageIcon?: boolean;
  showSearchIcon?: boolean;
  onBackPress?: () => void;
  customRightButton?: ReactNode;
}

export default function AppNavbar({ 
  title, 
  showLogo = true, 
  showProfileImage = true,
  showSettingsIcon = false,
  showBackButton = false,
  showMessageIcon = true,
  showSearchIcon = true,
  onBackPress,
  customRightButton,
}: AppNavbarProps = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const displayName = useMemo(() => {
    if (!user) return '';
    const fromFirst = (user.first_name || '').trim();
    if (fromFirst) return fromFirst;
    const fromUsername = (user.username || '').trim();
    if (fromUsername) return fromUsername;
    if (user.email) return user.email.split('@')[0] ?? '';
    return '';
  }, [user]);

  const initials = displayName ? displayName[0]?.toUpperCase() ?? 'U' : 'U';
  const avatarSrc = user?.profile_image_url ? resolveRemoteUrl(user.profile_image_url) : null;
  const avatarSource = avatarSrc ? { uri: avatarSrc } : DEFAULT_AVATAR;

  const myProfileHref = useMemo(() => {
    if (!user?.id) return undefined;
    return `/(tabs)/users/${user.id}`;
  }, [user?.id]);

  const handleNavigate = (href: string) => {
    router.push(href as any);
  };

  const styles = StyleSheet.create({
    header: {
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 2,
      borderBottomColor: '#C8A25F', // Gold border
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    backButton: {
      padding: 4,
      marginLeft: -4,
    },
    logoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      overflow: 'hidden',
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    logoText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    profileButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    profileInitials: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

  return (
    <LinearGradient
      colors={['#A31717', '#6E0E0E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress || (() => router.back())}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {showLogo ? (
            <TouchableOpacity
              style={styles.logoButton}
              onPress={() => handleNavigate('/(tabs)/feed')}
            >
              <View style={styles.logoIcon}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.logoText}>{title || 'Liberty Social'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.logoText}>{title || 'Liberty Social'}</Text>
          )}
        </View>

        {customRightButton ? (
          customRightButton
        ) : (
          <>
            {showSearchIcon && (
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => setSearchModalVisible(true)}
              >
                <Ionicons name="search" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {showMessageIcon && (
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => handleNavigate('/(tabs)/messages')}
              >
                <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {showProfileImage && (
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => {
                  // Navigate to own profile (same as bottom tab)
                  handleNavigate('/(tabs)/profile');
                }}
              >
                {avatarSrc ? (
                  <Image source={avatarSource} style={styles.profileImage} />
                ) : (
                  <Text style={styles.profileInitials}>{initials}</Text>
                )}
              </TouchableOpacity>
            )}

            {showSettingsIcon && (
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => handleNavigate('/(tabs)/settings')}
              >
                <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
      />
    </LinearGradient>
  );
}
