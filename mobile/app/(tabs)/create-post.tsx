import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Visibility } from '../../types';
import ScreenHeader from '../../components/layout/ScreenHeader';

const visibilityOptions: Visibility[] = ['public', 'friends', 'only_me'];

const formatVisibilityLabel = (value: Visibility) =>
  value
    .replace('_', ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export default function CreatePostScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [content, setContent] = useState('');
  const [mediaInput, setMediaInput] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      Alert.alert('Missing content', 'Please enter something to post.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: {
        content: string;
        visibility: Visibility;
        media_urls?: string[];
      } = {
        content: trimmedContent,
        visibility,
      };

      const mediaUrls = mediaInput
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);

      if (mediaUrls.length) {
        payload.media_urls = mediaUrls;
      }

      await apiClient.post('/posts/', payload);

      setContent('');
      setMediaInput('');
      setVisibility('public');

      Alert.alert('Success', 'Your post has been published!', [
        {
          text: 'View feed',
          onPress: () => router.replace('/(tabs)/feed'),
        },
        { text: 'Stay here' },
      ]);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Something went wrong while creating the post.';

      Alert.alert('Unable to create post', detail);
    } finally {
      setSubmitting(false);
    }
  };

  const themedStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    textarea: {
      minHeight: 150,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      color: colors.text,
      marginBottom: 16,
      textAlignVertical: 'top',
    },
    mediaInput: {
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      color: colors.text,
      marginBottom: 8,
      textAlignVertical: 'top',
    },
    helperText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    visibilityContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    visibilityButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
    },
    visibilityText: {
      fontSize: 14,
      fontWeight: '600',
    },
    submitButton: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.6,
    },
  });

  return (
    <View style={themedStyles.container}>
      <ScreenHeader title="Create Post" containerStyle={{ paddingBottom: 12 }} />
      <ScrollView
        contentContainerStyle={themedStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={themedStyles.label}>What's on your mind?</Text>
        <TextInput
          multiline
          style={themedStyles.textarea}
          placeholder="Share your thoughts..."
          placeholderTextColor={colors.textSecondary}
          value={content}
          onChangeText={setContent}
        />

        <Text style={themedStyles.label}>Media URLs (optional)</Text>
        <TextInput
          multiline
          style={themedStyles.mediaInput}
          placeholder="Paste image or video URLs, separated by commas or new lines"
          placeholderTextColor={colors.textSecondary}
          value={mediaInput}
          onChangeText={setMediaInput}
        />
        <Text style={themedStyles.helperText}>
          We currently support sharing media through direct URLs. Uploads are coming soon.
        </Text>

        <Text style={themedStyles.label}>Visibility</Text>
        <View style={themedStyles.visibilityContainer}>
          {visibilityOptions.map((option, index) => {
            const isSelected = visibility === option;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  themedStyles.visibilityButton,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? (isDark ? colors.backgroundSecondary : '#FFFFFF')
                      : 'transparent',
                    marginRight: index < visibilityOptions.length - 1 ? 8 : 0,
                  },
                ]}
                onPress={() => setVisibility(option)}
              >
                <Text
                  style={[
                    themedStyles.visibilityText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {formatVisibilityLabel(option)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            themedStyles.submitButton,
            (submitting || !content.trim()) && themedStyles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={submitting || !content.trim()}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={themedStyles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
