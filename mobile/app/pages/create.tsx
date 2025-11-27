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
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePageScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<{ uri: string; formData: FormData } | null>(null);
  const [coverImage, setCoverImage] = useState<{ uri: string; formData: FormData } | null>(null);
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
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Sorry, we need camera roll permissions to upload images!');
    }
  };

  const handlePickImage = async (type: 'profile' | 'cover') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: type === 'profile',
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const formData = new FormData();
        const filename = asset.uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const imageType = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('file', {
          uri: asset.uri,
          type: imageType,
          name: filename,
        } as any);

        if (type === 'profile') {
          setProfileImage({ uri: asset.uri, formData });
        } else {
          setCoverImage({ uri: asset.uri, formData });
        }
      }
    } catch (error) {
      showError('Failed to pick image');
      console.error(error);
    }
  };

  const handleRemoveImage = (type: 'profile' | 'cover') => {
    if (type === 'profile') {
      setProfileImage(null);
    } else {
      setCoverImage(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.name) {
      showError('Please enter a page name');
      return;
    }

    try {
      setSubmitting(true);
      setUploadingImage(true);

      // Upload images first
      let profileImageUrl = '';
      let coverImageUrl = '';

      if (profileImage) {
        try {
          const uploadResponse = await apiClient.postFormData('/uploads/images/', profileImage.formData);
          profileImageUrl = uploadResponse.url || '';
        } catch (error) {
          console.error('Failed to upload profile image:', error);
        }
      }

      if (coverImage) {
        try {
          const uploadResponse = await apiClient.postFormData('/uploads/images/', coverImage.formData);
          coverImageUrl = uploadResponse.url || '';
        } catch (error) {
          console.error('Failed to upload cover image:', error);
        }
      }

      setUploadingImage(false);

      // Create page with image URLs
      const pageData = {
        ...form,
        ...(profileImageUrl && { profile_image_url: profileImageUrl }),
        ...(coverImageUrl && { cover_image_url: coverImageUrl }),
      };

      await apiClient.post('/pages/', pageData);
      showSuccess('Page created successfully!');
      (global as any).showTabBar?.();
      router.push('/(tabs)/pages');
    } catch (error: any) {
      setUploadingImage(false);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || 'Failed to create page';
      showError(errorMessage);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { value: 'business', label: 'Business' },
    { value: 'community', label: 'Community' },
    { value: 'brand', label: 'Brand' },
    { value: 'other', label: 'Other' },
  ];

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
      marginBottom: 24,
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
    categoriesRow: {
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
      borderWidth: 1,
      borderColor: '#C8A25F',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
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
    imagePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      marginBottom: 8,
      gap: 8,
    },
    imagePickerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    imagePreviewContainer: {
      position: 'relative',
      marginBottom: 8,
    },
    imagePreview: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: colors.border,
    },
    coverImagePreview: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
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

  useEffect(() => {
    // Hide tab bar when entering create page
    (global as any).hideTabBar?.();
    
    // Show tab bar when leaving
    return () => {
      (global as any).showTabBar?.();
    };
  }, []);

  return (
    <View style={styles.container}>
      <AppNavbar 
        showProfileImage={false} 
        showSearchIcon={false}
        showMessageIcon={false}
        showBackButton={true}
        onBackPress={() => {
          (global as any).showTabBar?.();
          router.push('/(tabs)/pages');
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Profile Image */}
          <View style={styles.section}>
            <Text style={styles.label}>Profile Image</Text>
            {profileImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: profileImage.uri }} 
                  style={styles.imagePreview} 
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => handleRemoveImage('profile')}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={() => handlePickImage('profile')}
              >
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.imagePickerText}>Pick Profile Image</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Cover Image */}
          <View style={styles.section}>
            <Text style={styles.label}>Cover Image</Text>
            {coverImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: coverImage.uri }} 
                  style={styles.coverImagePreview} 
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => handleRemoveImage('cover')}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={() => handlePickImage('cover')}
              >
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.imagePickerText}>Pick Cover Image</Text>
              </TouchableOpacity>
            )}
          </View>

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

          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoriesRow}>
              {categories.map((category) => (
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

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people about your page..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
              value={form.website_url}
              onChangeText={(text) => setForm({ ...form, website_url: text })}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
            />
          </View>

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
            style={[styles.submitButton, (submitting || uploadingImage) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || uploadingImage}
          >
            {(submitting || uploadingImage) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Create Page</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

