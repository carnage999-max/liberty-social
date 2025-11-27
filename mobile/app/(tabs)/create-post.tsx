import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import { Visibility } from '../../types';
import AppNavbar from '../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import { getApiBase } from '../../constants/API';
import { storage } from '../../utils/storage';

const visibilityOptions: Visibility[] = ['public', 'friends', 'only_me'];

const formatVisibilityLabel = (value: Visibility) =>
  value
    .replace('_', ' ')
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export default function CreatePostScreen() {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string }>>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);

  const handlePickImages = async () => {
    if (selectedImages.length >= 6) {
      showError('You can upload up to 6 images per post.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6 - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 6 - selectedImages.length).map(asset => ({
          uri: asset.uri,
        }));

        setSelectedImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      showError('Failed to pick images. Please try again.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      showError('Please enter something to post.');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload images if any
      const uploadedUrls: string[] = [];
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          try {
            // Use fetch directly like profile image upload (axios has issues with React Native FormData)
            const base = getApiBase();
            const url = `${base.replace(/\/+$/, '')}/uploads/images/`;
            const accessToken = await storage.getAccessToken();
            
            // Create FormData fresh for each upload
            const formData = new FormData();
            const filename = image.uri.split('/').pop() || 'image.jpg';
            formData.append('file', {
              uri: image.uri,
              type: 'image/jpeg',
              name: filename,
            } as any);

            const response = await fetch(url, {
              method: 'POST',
              headers: accessToken ? {
                Authorization: `Bearer ${accessToken}`,
              } : {},
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Upload failed');
            }

            const uploadResponse = await response.json();
            if (uploadResponse.url) {
              uploadedUrls.push(uploadResponse.url);
            } else if (uploadResponse.urls && Array.isArray(uploadResponse.urls) && uploadResponse.urls.length > 0) {
              uploadedUrls.push(...uploadResponse.urls);
            }
          } catch (uploadError) {
            console.error('Image upload error:', uploadError);
            showError('Failed to upload some images. Please try again.');
            setSubmitting(false);
            return;
          }
        }
      }

      // Step 2: Create post with uploaded media URLs
      const payload: {
        content: string;
        visibility: Visibility;
        media_urls?: string[];
      } = {
        content: trimmedContent,
        visibility,
      };

      if (uploadedUrls.length > 0) {
        payload.media_urls = uploadedUrls;
      }

      const createdPost = await apiClient.post<{ id: number }>('/posts/', payload);

      // Clear form
      setContent('');
      setSelectedImages([]);
      setVisibility('public');

      // Show success toast with "View post" action
      showSuccess(
        'Your post has been published!',
        6000, // Longer duration (6 seconds)
        {
          label: 'View post',
          onPress: () => {
            router.push(`/(tabs)/feed/${createdPost.id}`);
          },
        }
      );
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Something went wrong while creating the post.';

      showError(detail);
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
      backgroundColor: '#192A4A',
      borderWidth: 1,
      borderColor: '#C8A25F',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.6,
    },
    imagePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      marginBottom: 16,
      gap: 8,
    },
    imagePickerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    imagesPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    imagePreviewWrapper: {
      width: '31%',
      aspectRatio: 1,
      borderRadius: 8,
      position: 'relative',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    removeImageButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 12,
      padding: 4,
    },
  });

  return (
    <View style={themedStyles.container}>
      <AppNavbar title="Create Post" showLogo={false} showProfileImage={false} />
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

        <Text style={themedStyles.label}>Add Images (up to 6)</Text>
        <TouchableOpacity 
          style={themedStyles.imagePickerButton} 
          onPress={handlePickImages}
          disabled={selectedImages.length >= 6}
        >
          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
          <Text style={themedStyles.imagePickerText}>
            {selectedImages.length >= 6 ? 'Maximum images reached' : 'Pick Images'}
          </Text>
        </TouchableOpacity>

        {selectedImages.length > 0 && (
          <View style={themedStyles.imagesPreview}>
            {selectedImages.map((image, index) => (
              <View key={index} style={themedStyles.imagePreviewWrapper}>
                <Image source={{ uri: image.uri }} style={themedStyles.imagePreview} />
                <TouchableOpacity
                  style={themedStyles.removeImageButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

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
                    borderColor: isSelected ? '#C8A25F' : colors.border,
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
                    { color: isSelected ? '#C8A25F' : colors.textSecondary },
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
