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
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Dropdown from '../../components/common/Dropdown';
import { US_STATES, STATE_CITIES, getStateCode } from '../../utils/usStatesCities';

interface Category {
  id: number;
  name: string;
  slug: string;
}

type Step = 'basic' | 'details' | 'contact' | 'media' | 'review';

const steps: { id: Step; label: string; description: string }[] = [
  { id: 'basic', label: 'Basic Info', description: 'Title, description, category' },
  { id: 'details', label: 'Details', description: 'Price, condition, location' },
  { id: 'contact', label: 'Contact & Delivery', description: 'Contact preferences' },
  { id: 'media', label: 'Photos', description: 'Upload images' },
  { id: 'review', label: 'Review', description: 'Confirm details' },
];

export default function CreateListingScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; formData: FormData }>>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    state: '',
    city: '',
    location: '',
    contact_preference: 'both',
    delivery_options: 'both',
  });

  useEffect(() => {
    // Hide tab bar when entering create page
    (global as any).hideTabBar?.();
    loadCategories();
    requestPermissions();
    
    // Show tab bar when leaving
    return () => {
      (global as any).showTabBar?.();
    };
  }, []);

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

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(form.title && form.category);
      case 'details':
        return !!(form.price && form.state && form.city);
      case 'contact':
        return true; // Optional step
      case 'media':
        return selectedImages.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goToStep = (step: Step) => {
    const stepIndex = steps.findIndex((s) => s.id === step);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    // Allow going back to previous steps
    if (stepIndex <= currentIndex || canProceed()) {
      setCurrentStep(step);
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      showError('Please fill in all required fields');
      return;
    }

    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as Step);
    }
  };

  const handlePrevious = () => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as Step);
    }
  };

  const handlePickImages = async () => {
    if (selectedImages.length >= 5) {
      showError('You can upload up to 5 images per listing.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 5 - selectedImages.length).map(asset => {
          const formData = new FormData();
          const filename = asset.uri.split('/').pop() || 'image.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';

          formData.append('file', {
            uri: asset.uri,
            type,
            name: filename,
          } as any);

          return { uri: asset.uri, formData };
        });

        setSelectedImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      showError('Failed to pick images. Please try again.');
      console.error(error);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.location || !form.category) {
      showError('Please fill in all required fields');
      return;
    }

    if (selectedImages.length === 0) {
      showError('Please upload at least one image');
      return;
    }

    try {
      setSubmitting(true);
      
      // Upload images first
      const uploadedUrls: string[] = [];
      for (const image of selectedImages) {
        try {
          const response = await apiClient.postFormData('/uploads/images/', image.formData);
          if (response.url) {
            uploadedUrls.push(response.url);
          } else if (response.urls && Array.isArray(response.urls) && response.urls.length > 0) {
            uploadedUrls.push(...response.urls);
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }

      if (uploadedUrls.length === 0) {
        showError('Failed to upload images. Please try again.');
        return;
      }
      
      // Create the listing
      const listingData = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category_id: parseInt(form.category),
        condition: form.condition,
        location: form.location,
        contact_preference: form.contact_preference,
        delivery_options: form.delivery_options,
        status: 'active',
      };

      const listing = await apiClient.post('/marketplace/listings/', listingData);

      // Link media to the listing using the correct endpoint
      if (uploadedUrls.length > 0) {
        const mediaPromises = uploadedUrls.map((url, index) =>
          apiClient.post('/marketplace/media/', {
            listing_id: listing.id,
            url: url,
            order: index,
          })
        );
        await Promise.all(mediaPromises);
      }
      
      showSuccess('Listing created successfully!');
      router.push(`/marketplace/${listing.id}`);
    } catch (error: any) {
      console.error('Create listing error:', error);
      const errorMessage = error?.response?.data?.detail || 
                          error?.response?.data?.message ||
                          (typeof error?.response?.data === 'object' && error?.response?.data 
                            ? JSON.stringify(error.response.data) 
                            : null) ||
                          error?.message || 
                          'Failed to create listing';
      showError(errorMessage);
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

  const renderStepIndicator = () => {
    const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
    const currentStepData = steps[currentStepIndex];
    
    return (
      <View style={styles.stepIndicator}>
        <View style={styles.stepIndicatorContent}>
          {/* Show all step numbers */}
          <View style={styles.stepNumbersRow}>
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              
              return (
                <React.Fragment key={step.id}>
                  <TouchableOpacity
                    style={styles.stepNumberButton}
                    onPress={() => goToStep(step.id)}
                    disabled={index > currentStepIndex && !canProceed()}
                  >
                    <View
                      style={[
                        styles.stepCircle,
                        isActive && styles.stepCircleActive,
                        isCompleted && styles.stepCircleCompleted,
                      ]}
                    >
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {index < steps.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        isCompleted && styles.stepConnectorCompleted,
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          
          {/* Show current step title */}
          <View style={styles.stepTitleContainer}>
            <Text style={styles.stepTitleText}>
              Step {currentStepIndex + 1}: {currentStepData.label}
            </Text>
            <Text style={styles.stepSubtitleText}>
              {currentStepData.description}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBasicInfo = () => (
    <View style={styles.stepContent}>
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

      {/* Category */}
      <Dropdown
        label="Category"
        required
        options={categories.map(cat => ({ value: cat.id.toString(), label: cat.name }))}
        value={form.category}
        onSelect={(value) => setForm({ ...form, category: value })}
        placeholder="Select category"
      />

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
    </View>
  );

  const renderDetails = () => (
    <View style={styles.stepContent}>
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

      {/* Condition */}
      <Dropdown
        label="Condition"
        options={conditions}
        value={form.condition}
        onSelect={(value) => setForm({ ...form, condition: value })}
        placeholder="Select condition"
      />

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
    </View>
  );

  const renderContact = () => (
    <View style={styles.stepContent}>
      {/* Contact Preference */}
      <Dropdown
        label="Contact Preference"
        options={contactPreferences}
        value={form.contact_preference}
        onSelect={(value) => setForm({ ...form, contact_preference: value })}
        placeholder="Select contact preference"
      />

      {/* Delivery Options */}
      <Dropdown
        label="Delivery Options"
        options={deliveryOptions}
        value={form.delivery_options}
        onSelect={(value) => setForm({ ...form, delivery_options: value })}
        placeholder="Select delivery option"
      />
    </View>
  );

  const renderMedia = () => (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <Text style={styles.label}>
          Images <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handlePickImages}
          disabled={selectedImages.length >= 5}
        >
          <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.uploadText}>
            {selectedImages.length >= 5 
              ? 'Maximum images reached (5)' 
              : `Tap to upload images (${selectedImages.length}/5)`}
          </Text>
        </TouchableOpacity>

        {selectedImages.length > 0 && (
          <View style={styles.imagesGrid}>
            {selectedImages.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: image.uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContent}>
      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Title</Text>
        <Text style={styles.reviewValue}>{form.title || 'N/A'}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Category</Text>
        <Text style={styles.reviewValue}>
          {categories.find(c => c.id.toString() === form.category)?.name || 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Price</Text>
        <Text style={styles.reviewValue}>${form.price || '0.00'}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Condition</Text>
        <Text style={styles.reviewValue}>
          {conditions.find(c => c.value === form.condition)?.label || 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Location</Text>
        <Text style={styles.reviewValue}>{form.location || 'N/A'}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Contact Preference</Text>
        <Text style={styles.reviewValue}>
          {contactPreferences.find(p => p.value === form.contact_preference)?.label || 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Delivery Options</Text>
        <Text style={styles.reviewValue}>
          {deliveryOptions.find(o => o.value === form.delivery_options)?.label || 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Images</Text>
        <Text style={styles.reviewValue}>{selectedImages.length} image(s)</Text>
      </View>

      {form.description && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Description</Text>
          <Text style={styles.reviewValue}>{form.description}</Text>
        </View>
      )}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'basic':
        return renderBasicInfo();
      case 'details':
        return renderDetails();
      case 'contact':
        return renderContact();
      case 'media':
        return renderMedia();
      case 'review':
        return renderReview();
      default:
        return renderBasicInfo();
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
    stepIndicator: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepIndicatorContent: {
      alignItems: 'center',
    },
    stepNumbersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    stepNumberButton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    stepCircleActive: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    stepCircleCompleted: {
      backgroundColor: '#C8A25F',
      borderColor: '#C8A25F',
    },
    stepNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    stepNumberActive: {
      color: '#FFFFFF',
    },
    stepConnector: {
      width: 30,
      height: 2,
      backgroundColor: colors.border,
      marginHorizontal: 8,
    },
    stepConnectorCompleted: {
      backgroundColor: '#C8A25F',
    },
    stepTitleContainer: {
      alignItems: 'center',
    },
    stepTitleText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    stepSubtitleText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    stepContent: {
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
    uploadArea: {
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      minHeight: 100,
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
      marginBottom: 8,
    },
    imageContainer: {
      width: '31%',
      aspectRatio: 1,
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
    primaryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    primaryBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    reviewSection: {
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    reviewLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    reviewValue: {
      fontSize: 16,
      color: colors.text,
    },
    navigationButtons: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
    },
    navButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
    },
    navButtonSecondary: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    navButtonPrimary: {
      backgroundColor: '#192A4A',
      borderColor: '#C8A25F',
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    navButtonTextSecondary: {
      color: colors.text,
    },
    navButtonTextPrimary: {
      color: '#FFFFFF',
    },
  });

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Create Listing"
        showProfileImage={false} 
        showSearchIcon={false} 
        showMessageIcon={false}
        showBackButton={true}
        showLogo={false}
        onBackPress={() => {
          (global as any).showTabBar?.();
          router.push('/(tabs)/marketplace');
        }} 
      />
      
      {renderStepIndicator()}
      
      <ScrollView style={styles.scrollView}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.navigationButtons}>
        {currentStepIndex > 0 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSecondary]}
            onPress={handlePrevious}
          >
            <Text style={[styles.navButtonText, styles.navButtonTextSecondary]}>
              Previous
            </Text>
          </TouchableOpacity>
        )}
        
        {!isLastStep ? (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              !canProceed() && { opacity: 0.5 },
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>
              Next
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              (submitting || !canProceed()) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={submitting || !canProceed()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>
                Create Listing
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
