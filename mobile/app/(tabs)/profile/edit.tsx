import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import * as ImagePicker from 'expo-image-picker';
import { resolveRemoteUrl, DEFAULT_AVATAR } from '../../../utils/url';
import ImageGallery from '../../../components/common/ImageGallery';

export default function EditProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, updateUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileImage, setProfileImage] = useState(user?.profile_image_url || '');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      let uploadedImageUrl = profileImage;

      // Upload new profile image if selected
      if (selectedImage) {
        try {
        const formData = new FormData();
        const filename = selectedImage.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: selectedImage,
          name: filename,
          type,
        } as any);

          const uploadResponse = await apiClient.postFormData<{ url: string }>('/uploads/images/', formData);
          
          if (uploadResponse.url) {
        uploadedImageUrl = uploadResponse.url;
          } else if ((uploadResponse as any).urls && Array.isArray((uploadResponse as any).urls) && (uploadResponse as any).urls.length > 0) {
            uploadedImageUrl = (uploadResponse as any).urls[0];
          } else {
            throw new Error('No image URL returned from upload');
          }
        } catch (uploadError: any) {
          console.error('Profile image upload error:', uploadError);
          const errorMessage = uploadError?.response?.data?.detail || 
                              uploadError?.response?.data?.message || 
                              uploadError?.message || 
                              'Failed to upload image. Please check your internet connection and try again.';
          showError(`Failed to upload profile photo: ${errorMessage}`);
          setSaving(false);
          return;
        }
      }

      // Update user profile
      const updateData = {
        first_name: firstName,
        last_name: lastName,
        username: username || null,
        bio: bio || null,
        profile_image_url: uploadedImageUrl,
      };

      const updatedUser = await apiClient.patch(`/auth/user/${user?.id}/`, updateData);
      updateUser(updatedUser);

      showSuccess('Profile updated successfully!');
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100, // Extra padding to ensure bio field is visible when keyboard is active
    },
    avatarContainer: {
      alignItems: 'center',
      marginBottom: 24,
      marginTop: 16,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    changePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    changePhotoText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bioInput: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
  });

  const avatarUri = selectedImage || (profileImage ? resolveRemoteUrl(profileImage) : null);
  const avatarSource = avatarUri ? { uri: avatarUri } : DEFAULT_AVATAR;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <AppNavbar 
        title="Edit Profile" 
        showLogo={false} 
        showProfileImage={false} 
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/profile')}
      />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              const images: string[] = [];
              if (selectedImage) {
                images.push(selectedImage);
              } else if (profileImage) {
                const resolved = resolveRemoteUrl(profileImage);
                if (resolved) images.push(resolved);
              }
              if (images.length > 0) {
                setGalleryImages(images);
                setGalleryIndex(0);
                setGalleryVisible(true);
              }
            }}
          >
          <Image source={avatarSource} style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.changePhotoButton} onPress={handlePickImage}>
            <Ionicons name="camera" size={20} color={colors.primary} />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your last name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ImageGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        images={galleryImages}
        initialIndex={galleryIndex}
        title={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username || 'Profile Image'}
      />
    </KeyboardAvoidingView>
  );
}

