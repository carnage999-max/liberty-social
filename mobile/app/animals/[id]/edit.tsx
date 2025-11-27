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
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiClient } from '../../../utils/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppNavbar from '../../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { resolveRemoteUrl } from '../../../utils/url';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function EditAnimalListingScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    title: '',
    breed: '',
    category: '',
    description: '',
    gender: 'unknown',
    age_value: '1',
    age_unit: 'months',
    color: '',
    listing_type: 'sale',
    price: '',
    city: '',
    state: '',
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
      const response = await apiClient.get<any>('/animals/categories/');
      setCategories(response.results || response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadListing = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/animals/listings/${id}/`);
      const ageYears = response.age_years || 0;
      const ageMonths = response.age_months || 0;
      setForm({
        title: response.title || '',
        breed: response.breed || '',
        category: response.category || '',
        description: response.description || '',
        gender: response.gender || 'unknown',
        age_value: ageYears > 0 ? ageYears.toString() : ageMonths.toString(),
        age_unit: ageYears > 0 ? 'years' : 'months',
        color: response.color || '',
        listing_type: response.listing_type || 'sale',
        price: response.price ? response.price.toString() : '',
        city: response.location?.split(',')[0] || '',
        state: response.state_code || '',
      });
      if (response.media || response.animal_listing_media) {
        const media = response.media || response.animal_listing_media || [];
        setImages(media.map((m: any) => resolveRemoteUrl(m.url)).filter((url: string) => url));
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
    if (!form.title || !form.breed || !form.category || !form.city || !form.state) {
      showError('Please fill in all required fields');
      return;
    }

    if (form.listing_type === 'sale' && !form.price) {
      showError('Please enter a price for sale listings');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert age to years/months
      let age_years = 0;
      let age_months = 0;
      const ageValue = parseInt(form.age_value) || 0;
      if (form.age_unit === 'years') {
        age_years = ageValue;
      } else if (form.age_unit === 'months') {
        age_months = ageValue;
      } else if (form.age_unit === 'days') {
        age_months = Math.floor(ageValue / 30);
      }

      // Update the listing
      const listingData = {
        title: form.title,
        breed: form.breed,
        category: form.category,
        description: form.description,
        gender: form.gender,
        age_years,
        age_months,
        color: form.color,
        listing_type: form.listing_type,
        price: form.listing_type === 'sale' ? (parseFloat(form.price) || 0) : 0,
        location: `${form.city}, ${form.state}`,
        state_code: form.state,
      };

      await apiClient.patch(`/animals/listings/${id}/`, listingData);

      // Update media if changed
      if (images.length > 0) {
        // Note: Media update would need to be handled separately
        // This is a simplified version
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

  const listingTypes = [
    { value: 'sale', label: 'For Sale' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'rehoming', label: 'Rehoming' },
  ];

  const genders = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'unknown', label: 'Unknown' },
  ];

  const ageUnits = [
    { value: 'days', label: 'Days' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' },
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
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    rowItem: {
      flex: 1,
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
            </TouchableOpacity>

            {images.length > 0 && (
              <View style={styles.imagesGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image 
                      source={{ uri }} 
                      style={styles.image} 
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
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
              placeholder="e.g., Beautiful Golden Retriever Puppies"
              placeholderTextColor={colors.textSecondary}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />
          </View>

          {/* Breed & Category */}
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>
                  Breed <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Golden Retriever"
                  placeholderTextColor={colors.textSecondary}
                  value={form.breed}
                  onChangeText={(text) => setForm({ ...form, breed: text })}
                />
              </View>
            </View>
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
                    form.category === category.id && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, category: category.id })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.category === category.id && styles.optionChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Age */}
          <View style={styles.section}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.row}>
              <View style={[styles.rowItem, { flex: 0.4 }]}>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={form.age_value}
                  onChangeText={(text) => setForm({ ...form, age_value: text })}
                />
              </View>
              <View style={[styles.rowItem, { flex: 0.6 }]}>
                <View style={styles.optionsRow}>
                  {ageUnits.map((unit) => (
                    <TouchableOpacity
                      key={unit.value}
                      style={[
                        styles.optionChip,
                        form.age_unit === unit.value && styles.optionChipActive,
                      ]}
                      onPress={() => setForm({ ...form, age_unit: unit.value })}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          form.age_unit === unit.value && styles.optionChipTextActive,
                        ]}
                      >
                        {unit.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Gender & Color */}
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.optionsRow}>
                  {genders.map((gender) => (
                    <TouchableOpacity
                      key={gender.value}
                      style={[
                        styles.optionChip,
                        form.gender === gender.value && styles.optionChipActive,
                      ]}
                      onPress={() => setForm({ ...form, gender: gender.value })}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          form.gender === gender.value && styles.optionChipTextActive,
                        ]}
                      >
                        {gender.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Golden"
              placeholderTextColor={colors.textSecondary}
              value={form.color}
              onChangeText={(text) => setForm({ ...form, color: text })}
            />
          </View>

          {/* Listing Type */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Listing Type <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.optionsRow}>
              {listingTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionChip,
                    form.listing_type === type.value && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, listing_type: type.value })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.listing_type === type.value && styles.optionChipTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price (if sale) */}
          {form.listing_type === 'sale' && (
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
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the animal..."
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
            <View style={styles.row}>
              <View style={[styles.rowItem, { flex: 0.6 }]}>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor={colors.textSecondary}
                  value={form.city}
                  onChangeText={(text) => setForm({ ...form, city: text })}
                />
              </View>
              <View style={[styles.rowItem, { flex: 0.4 }]}>
                <View style={styles.optionsRow}>
                  {US_STATES.slice(0, 10).map((state) => (
                    <TouchableOpacity
                      key={state}
                      style={[
                        styles.optionChip,
                        form.state === state && styles.optionChipActive,
                      ]}
                      onPress={() => setForm({ ...form, state })}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          form.state === state && styles.optionChipTextActive,
                        ]}
                      >
                        {state}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.uploadText, { fontSize: 12, marginTop: 4 }]}>
                  (More states available)
                </Text>
              </View>
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

