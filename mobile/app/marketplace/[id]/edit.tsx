import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { resolveRemoteUrl } from '../../../utils/url';

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function EditListingScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    location: '',
    contact_preference: 'both',
    delivery_options: 'both',
  });

  useEffect(() => {
    loadCategories();
    loadListing();
    requestPermissions();
  }, [id]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Sorry, we need camera roll permissions to upload images!');
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiClient.get<any>('/marketplace/categories/');
      setCategories(response.results || response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadListing = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/marketplace/listings/${id}/`);
      setForm({
        title: response.title || '',
        description: response.description || '',
        price: response.price ? parseFloat(response.price).toString() : '',
        category: response.category_id ? response.category_id.toString() : '',
        condition: response.condition || 'used',
        location: response.location || '',
        contact_preference: response.contact_preference || 'both',
        delivery_options: response.delivery_options || 'both',
      });
      if (response.media && response.media.length > 0) {
        setImages(response.media.map((m: any) => resolveRemoteUrl(m.url)));
      }
    } catch (error) {
      showError('Failed to load listing');
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setUploadingImage(true);
        const uploadedUrls: string[] = [];

        for (const asset of result.assets) {
          try {
            const formData = new FormData();
            const uri = asset.uri;
            const filename = uri.split('/').pop() || 'image.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('file', {
              uri,
              name: filename,
              type,
            } as any);

            const response = await apiClient.post('/uploads/images/', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            if (response.url) {
              uploadedUrls.push(response.url);
            }
          } catch (error) {
            console.error('Failed to upload image:', error);
          }
        }

        setImages([...images, ...uploadedUrls]);
        setUploadingImage(false);
        
        if (uploadedUrls.length > 0) {
          showSuccess(`${uploadedUrls.length} image(s) uploaded`);
        }
      }
    } catch (error) {
      setUploadingImage(false);
      showError('Failed to pick image');
      console.error(error);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.location || !form.category) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      const listingData = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category_id: parseInt(form.category),
        condition: form.condition,
        location: form.location,
        contact_preference: form.contact_preference,
        delivery_options: form.delivery_options,
      };

      await apiClient.patch(`/marketplace/listings/${id}/`, listingData);

      // Update media if changed
      if (images.length > 0) {
        // Note: Media update would need to be handled separately
      }
      
      showSuccess('Listing updated successfully!');
      router.back();
    } catch (error: any) {
      showError(error?.message || 'Failed to update listing');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'used', label: 'Used' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  const contactPreferences = [
    { value: 'chat', label: 'Chat Only' },
    { value: 'call', label: 'Call Only' },
    { value: 'both', label: 'Both' },
  ];

  const deliveryOptions = [
    { value: 'pickup', label: 'Pickup' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'both', label: 'Both' },
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
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionChipActive: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    optionChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    optionChipTextActive: {
      color: '#FFFFFF',
    },
    uploadArea: {
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
    },
    uploadText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    imagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    imageContainer: {
      width: 80,
      height: 80,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    removeButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
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
          <View style={styles.section}>
            <Text style={styles.label}>
              Images <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.uploadArea}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              <Ionicons name="cloud-upload-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.uploadText}>
                {uploadingImage ? 'Uploading...' : 'Tap to upload images'}
              </Text>
              <Text style={[styles.uploadText, { fontSize: 12 }]}>
                {images.length}/5 images
              </Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <View style={styles.imagesGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    {index === 0 && (
                      <View style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        backgroundColor: colors.primary,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}>
                        <Text style={{
                          color: '#FFFFFF',
                          fontSize: 10,
                          fontWeight: '700',
                        }}>Primary</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="What are you selling?"
              placeholderTextColor={colors.textSecondary}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />
          </View>

          {/* Price */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Price <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={form.price}
              onChangeText={(text) => setForm({ ...form, price: text })}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.optionsRow}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.optionChip,
                    form.category === category.id.toString() && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, category: category.id.toString() })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.category === category.id.toString() && styles.optionChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Condition */}
          <View style={styles.section}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.optionsRow}>
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition.value}
                  style={[
                    styles.optionChip,
                    form.condition === condition.value && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, condition: condition.value })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.condition === condition.value && styles.optionChipTextActive,
                    ]}
                  >
                    {condition.label}
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
              placeholder="Describe your item..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Location <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="City, State"
              placeholderTextColor={colors.textSecondary}
              value={form.location}
              onChangeText={(text) => setForm({ ...form, location: text })}
            />
          </View>

          {/* Contact Preference */}
          <View style={styles.section}>
            <Text style={styles.label}>Contact Preference</Text>
            <View style={styles.optionsRow}>
              {contactPreferences.map((pref) => (
                <TouchableOpacity
                  key={pref.value}
                  style={[
                    styles.optionChip,
                    form.contact_preference === pref.value && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, contact_preference: pref.value })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.contact_preference === pref.value && styles.optionChipTextActive,
                    ]}
                  >
                    {pref.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Delivery Options */}
          <View style={styles.section}>
            <Text style={styles.label}>Delivery Options</Text>
            <View style={styles.optionsRow}>
              {deliveryOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    form.delivery_options === option.value && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, delivery_options: option.value })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.delivery_options === option.value && styles.optionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Update Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

