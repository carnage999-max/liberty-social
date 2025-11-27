import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import { resolveRemoteUrl } from '../../../utils/url';

const CATEGORIES = [
  { value: 'business', label: 'Business' },
  { value: 'brand', label: 'Brand' },
  { value: 'organization', label: 'Organization' },
  { value: 'public_figure', label: 'Public Figure' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
];

export default function EditPageScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<{ uri: string; formData?: FormData } | null>(null);
  const [coverImage, setCoverImage] = useState<{ uri: string; formData?: FormData } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'business',
    website_url: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    requestPermissions();
    loadPage();
  }, [id]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Sorry, we need camera roll permissions to upload images!');
    }
  };

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/pages/${id}/`);
      setForm({
        name: response.name || '',
        description: response.description || '',
        category: response.category || 'business',
        website_url: response.website_url || '',
        phone: response.phone || '',
        email: response.email || '',
      });
      if (response.profile_image_url) {
        setProfileImage({ uri: resolveRemoteUrl(response.profile_image_url) });
      }
      if (response.cover_image_url) {
        setCoverImage({ uri: resolveRemoteUrl(response.cover_image_url) });
      }
    } catch (error) {
      showError('Failed to load page');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (type: 'profile' | 'cover') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'cover' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        const asset = result.assets[0];
        const formData = new FormData();
        const filename = asset.uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: asset.uri,
          name: filename,
          type,
        } as any);

        try {
          const uploadResponse = await apiClient.post('/uploads/images/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (uploadResponse.url) {
            if (type === 'profile') {
              setProfileImage({ uri: uploadResponse.url });
            } else {
              setCoverImage({ uri: uploadResponse.url });
            }
            showSuccess('Image uploaded');
          }
        } catch (error) {
          showError('Failed to upload image');
          console.error(error);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      showError('Failed to pick image');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    if (!form.name) {
      showError('Page name is required');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        name: form.name,
        description: form.description,
        category: form.category,
        website_url: form.website_url,
        phone: form.phone,
        email: form.email,
      };

      if (profileImage?.uri && !profileImage.uri.startsWith('http')) {
        payload.profile_image_url = profileImage.uri;
      } else if (profileImage?.uri) {
        payload.profile_image_url = profileImage.uri;
      }

      if (coverImage?.uri && !coverImage.uri.startsWith('http')) {
        payload.cover_image_url = coverImage.uri;
      } else if (coverImage?.uri) {
        payload.cover_image_url = coverImage.uri;
      }

      await apiClient.patch(`/pages/${id}/`, payload);
      showSuccess('Page updated successfully!');
      router.back();
    } catch (error: any) {
      showError(error?.message || 'Failed to update page');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      color: colors.text,
    },
    required: {
      color: '#FF4D4F',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    imageSection: {
      marginBottom: 20,
    },
    imageRow: {
      flexDirection: 'row',
      gap: 16,
    },
    imageContainer: {
      flex: 1,
    },
    imageLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      color: colors.text,
    },
    imagePlaceholder: {
      width: '100%',
      height: 120,
      borderRadius: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePreview: {
      width: '100%',
      height: 120,
      borderRadius: 12,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageButton: {
      marginTop: 8,
    },
    imageButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    categoryChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    submitButton: {
      backgroundColor: '#192A4A',
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 8,
      borderWidth: 2,
      borderColor: '#C8A25F',
      shadowColor: '#C8A25F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppNavbar showProfileImage={false} showSearchIcon={false} showBackButton={true} onBackPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavbar showProfileImage={false} showSearchIcon={false} showBackButton={true} onBackPress={() => router.back()} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Images */}
          <View style={styles.imageSection}>
            <View style={styles.imageRow}>
              <View style={styles.imageContainer}>
                <Text style={styles.imageLabel}>Profile Image</Text>
                {profileImage ? (
                  <View style={styles.imagePreview}>
                    <Image 
                      source={{ uri: profileImage.uri }} 
                      style={styles.image} 
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={() => handlePickImage('profile')}
                  disabled={uploadingImage}
                >
                  <Text style={styles.imageButtonText}>
                    {uploadingImage ? 'Uploading...' : profileImage ? 'Change' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imageContainer}>
                <Text style={styles.imageLabel}>Cover Image</Text>
                {coverImage ? (
                  <View style={styles.imagePreview}>
                    <Image 
                      source={{ uri: coverImage.uri }} 
                      style={styles.image} 
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={() => handlePickImage('cover')}
                  disabled={uploadingImage}
                >
                  <Text style={styles.imageButtonText}>
                    {uploadingImage ? 'Uploading...' : coverImage ? 'Change' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Page Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter page name"
              placeholderTextColor={colors.textSecondary}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryChip,
                    form.category === category.value && styles.categoryChipActive,
                  ]}
                  onPress={() => setForm({ ...form, category: category.value })}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      form.category === category.value && styles.categoryChipTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your page..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />
          </View>

          {/* Website */}
          <View style={styles.section}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="url"
              value={form.website_url}
              onChangeText={(text) => setForm({ ...form, website_url: text })}
            />
          </View>

          {/* Phone */}
          <View style={styles.section}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
            />
          </View>

          {/* Email */}
          <View style={styles.section}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="contact@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Update Page</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

