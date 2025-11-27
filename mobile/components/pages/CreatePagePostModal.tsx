import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiBase } from '../../constants/API';
import { storage } from '../../utils/storage';

interface CreatePagePostModalProps {
  visible: boolean;
  pageId: number;
  onClose: () => void;
  onPostCreated?: () => void;
}

const MAX_IMAGES = 6;

export default function CreatePagePostModal({
  visible,
  pageId,
  onClose,
  onPostCreated,
}: CreatePagePostModalProps) {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string }>>([]);
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'only_me'>('public');
  const [submitting, setSubmitting] = useState(false);

  const handlePickImages = async () => {
    if (selectedImages.length >= MAX_IMAGES) {
      showError(`You can upload up to ${MAX_IMAGES} images per post.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: MAX_IMAGES - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, MAX_IMAGES - selectedImages.length).map(asset => ({
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
      // Upload images if any
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
            console.error('Upload error:', uploadError);
            showError('Failed to upload some images. Please try again.');
            setSubmitting(false);
            return;
          }
        }
      }

      // Create page post
      const payload: {
        content: string;
        page_id: number; // API expects page_id, not page
        visibility?: string;
        media_urls?: string[];
      } = {
        content: trimmedContent,
        page_id: pageId,
        visibility,
      };

      if (uploadedUrls.length > 0) {
        payload.media_urls = uploadedUrls;
      }

      console.log('Creating post with payload:', payload);
      const response = await apiClient.post('/posts/', payload);
      console.log('Post creation response:', response);

      // Reset form
      setContent('');
      setSelectedImages([]);
      setVisibility('public');

      showSuccess('Page post created successfully!');
      onPostCreated?.();
      onClose();
    } catch (error: any) {
      console.error('Post creation error:', error);
      console.error('Error response:', error?.response?.data);
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Something went wrong while creating the post.';
      showError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setContent('');
      setSelectedImages([]);
      setVisibility('public');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF' }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Create Page Post</Text>
            <TouchableOpacity onPress={handleClose} disabled={submitting}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Content Input */}
            <TextInput
              style={[styles.textInput, { 
                color: colors.text, 
                backgroundColor: isDark ? colors.backgroundSecondary : '#F8F9FF',
                borderColor: colors.border,
              }]}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!submitting}
            />

            {/* Visibility Selector */}
            <View style={styles.visibilityContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Visibility</Text>
              <View style={styles.visibilityButtons}>
                <TouchableOpacity
                  style={[
                    styles.visibilityButton,
                    visibility === 'public' && styles.visibilityButtonActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setVisibility('public')}
                >
                  <Text style={[styles.visibilityButtonText, { color: colors.text }]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visibilityButton,
                    visibility === 'only_me' && styles.visibilityButtonActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setVisibility('only_me')}
                >
                  <Text style={[styles.visibilityButtonText, { color: colors.text }]}>Only Me</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.visibilityButton,
                    visibility === 'friends' && styles.visibilityButtonActive,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setVisibility('friends')}
                >
                  <Text style={[styles.visibilityButtonText, { color: colors.text }]}>Friends</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Images Preview */}
            {selectedImages.length > 0 && (
              <View style={styles.imagesContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Images ({selectedImages.length}/{MAX_IMAGES})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedImages.map((image, index) => (
                    <View key={index} style={styles.imageWrapper}>
                      <Image 
                        source={{ uri: image.uri }} 
                        style={styles.imagePreview} 
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#FF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Add Images Button */}
            {selectedImages.length < MAX_IMAGES && (
              <TouchableOpacity
                style={[styles.addImageButton, { borderColor: colors.border }]}
                onPress={handlePickImages}
              >
                <Ionicons name="image-outline" size={24} color={colors.primary} />
                <Text style={[styles.addImageText, { color: colors.primary }]}>Add Images</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, { borderColor: colors.border }]}
              onPress={handleSubmit}
              disabled={submitting || !content.trim()}
            >
              <LinearGradient
                colors={['#192A4A', '#1a2335']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Post</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    maxHeight: '90%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    minHeight: 200,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  textInput: {
    minHeight: 120,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  visibilityContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  visibilityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  visibilityButtonActive: {
    backgroundColor: '#192A4A',
    borderColor: '#C8A25F',
  },
  visibilityButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  imagesContainer: {
    marginBottom: 20,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addImageText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  submitButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

