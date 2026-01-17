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
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Dropdown from '../../components/common/Dropdown';

interface Category {
  id: string;
  name: string;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Major cities by state (simplified - you can expand this)
const US_CITIES_BY_STATE: Record<string, string[]> = {
  'AL': ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'],
  'AK': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
  'AZ': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise'],
  'AR': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  'CA': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Oxnard'],
  'CO': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'],
  'CT': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury'],
  'DE': ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna'],
  'FL': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral'],
  'GA': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens'],
  'HI': ['Honolulu', 'Hilo', 'Kailua', 'Kaneohe', 'Pearl City'],
  'ID': ['Boise', 'Nampa', 'Meridian', 'Idaho Falls', 'Pocatello'],
  'IL': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield', 'Peoria', 'Elgin'],
  'IN': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  'IA': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  'KS': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'],
  'KY': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  'LA': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  'ME': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  'MD': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie'],
  'MA': ['Boston', 'Worcester', 'Springfield', 'Lowell', 'Cambridge'],
  'MI': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Lansing'],
  'MN': ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'],
  'MS': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
  'MO': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
  'MT': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'],
  'NE': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  'NV': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  'NH': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester'],
  'NJ': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'],
  'NM': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  'NY': ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica'],
  'NC': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'],
  'ND': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'],
  'OK': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton'],
  'OR': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro'],
  'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'],
  'RI': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'],
  'SC': ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'],
  'SD': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  'TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  'TX': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo'],
  'UT': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
  'VT': ['Burlington', 'Essex', 'South Burlington', 'Colchester', 'Montpelier'],
  'VA': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News'],
  'WA': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
  'WV': ['Charleston', 'Huntington', 'Parkersburg', 'Morgantown', 'Wheeling'],
  'WI': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
  'WY': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
};

type Step = 'basic' | 'pricing' | 'health' | 'media' | 'review';

const steps: { id: Step; label: string; description: string }[] = [
  { id: 'basic', label: 'Basic Info', description: 'Title, breed, category' },
  { id: 'pricing', label: 'Pricing & Location', description: 'Price & location' },
  { id: 'health', label: 'Health Documents', description: 'Veterinary documents' },
  { id: 'media', label: 'Photos & Media', description: 'Upload images' },
  { id: 'review', label: 'Review', description: 'Confirm details' },
];

export default function CreateAnimalListingScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; formData: FormData }>>([]);
  const [healthDocuments, setHealthDocuments] = useState<Array<{ uri: string; formData: FormData; name: string }>>([]);
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
    const { status: imageStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (imageStatus !== 'granted') {
      showError('Sorry, we need camera roll permissions to upload images!');
    }
  };

  const handlePickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newDocs = result.assets.map(asset => {
          const formData = new FormData();
          const filename = asset.name || asset.uri.split('/').pop() || 'document.pdf';
          const match = /\.(\w+)$/.exec(filename);
          let type = 'application/pdf';
          if (match) {
            const ext = match[1].toLowerCase();
            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
              type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            }
          }

          formData.append('file', {
            uri: asset.uri,
            type,
            name: filename,
          } as any);

          return { uri: asset.uri, formData, name: filename };
        });

        setHealthDocuments(prev => [...prev, ...newDocs]);
      }
    } catch (error) {
      showError('Failed to pick documents. Please try again.');
      console.error(error);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setHealthDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const loadCategories = async () => {
    try {
      const response = await apiClient.get<any>('/animals/categories/');
      setCategories(response.results || response);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(form.title && form.category);
      case 'pricing':
        return !!(form.listing_type && form.city && form.state && 
                 (form.listing_type === 'sale' ? form.price : true));
      case 'health':
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
    if (selectedImages.length >= 10) {
      showError('You can upload up to 10 images per listing.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.slice(0, 10 - selectedImages.length).map(asset => {
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
    if (!form.title || !form.category || !form.city || !form.state) {
      showError('Please fill in all required fields');
      return;
    }

    if (form.listing_type === 'sale' && !form.price) {
      showError('Please enter a price for sale listings');
      return;
    }

    if (selectedImages.length === 0) {
      showError('Please upload at least one image');
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

      // Step 1: Upload images
      const uploadedUrls: string[] = [];
      if (selectedImages.length > 0) {
        for (const image of selectedImages) {
          try {
            const uploadResponse = await apiClient.postFormData('/uploads/images/', image.formData);
            if (uploadResponse.url) {
              uploadedUrls.push(uploadResponse.url);
            } else if (uploadResponse.urls && Array.isArray(uploadResponse.urls) && uploadResponse.urls.length > 0) {
              uploadedUrls.push(...uploadResponse.urls);
            }
          } catch (uploadError) {
            console.error('Failed to upload image:', uploadError);
          }
        }
      }

      if (uploadedUrls.length === 0) {
        showError('Failed to upload images. Please try again.');
        setSubmitting(false);
        return;
      }

      // Step 2: Create the listing
      const listingData: any = {
        title: form.title.trim(),
        breed: form.breed.trim() || '',
        category: form.category || null,
        description: form.description.trim() || 'No description provided',
        gender: form.gender || 'unknown',
        age_years,
        age_months,
        listing_type: form.listing_type,
        price: form.listing_type === 'sale' ? (parseFloat(form.price) || 0) : 0,
        location: `${form.city.trim()}, ${US_STATES.find(s => s.code === form.state)?.name || form.state}`,
        state_code: form.state,
        media_urls: uploadedUrls,
      };

      // Add optional fields only if they have values
      if (form.color && form.color.trim()) {
        listingData.color = form.color.trim();
      }

      const listing = await apiClient.post('/animals/listings/', listingData);
      
      showSuccess('Listing created successfully!');
      router.push(`/animals/${listing.slug ?? listing.id}`);
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
          placeholder="e.g., Beautiful Golden Retriever Puppies"
          placeholderTextColor={colors.textSecondary}
          value={form.title}
          onChangeText={(text) => setForm({ ...form, title: text })}
        />
      </View>

      {/* Breed */}
      <View style={styles.section}>
        <Text style={styles.label}>Breed</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Golden Retriever"
          placeholderTextColor={colors.textSecondary}
          value={form.breed}
          onChangeText={(text) => setForm({ ...form, breed: text })}
        />
      </View>

      {/* Category */}
      <Dropdown
        label="Category"
        required
        options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
        value={form.category}
        onSelect={(value) => setForm({ ...form, category: value })}
        placeholder="Select category"
      />

      {/* Age */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={[styles.rowItem, { flex: 0.5 }]}>
            <Text style={styles.label}>Age Value</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={form.age_value}
              onChangeText={(text) => setForm({ ...form, age_value: text })}
            />
          </View>
          <View style={[styles.rowItem, { flex: 0.5 }]}>
            <Dropdown
              label="Age Unit"
              options={ageUnits}
              value={form.age_unit}
              onSelect={(value) => setForm({ ...form, age_unit: value })}
              placeholder="Select unit"
            />
          </View>
        </View>
      </View>

      {/* Gender */}
      <Dropdown
        label="Gender"
        options={genders}
        value={form.gender}
        onSelect={(value) => setForm({ ...form, gender: value })}
        placeholder="Select gender"
      />

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
    </View>
  );

  const renderPricing = () => (
    <View style={styles.stepContent}>
      {/* Listing Type */}
      <Dropdown
        label="Listing Type"
        required
        options={listingTypes}
        value={form.listing_type}
        onSelect={(value) => setForm({ ...form, listing_type: value })}
        placeholder="Select listing type"
      />

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

      {/* Location */}
      <Dropdown
        label="State"
        required
        options={US_STATES.map(state => ({ value: state.code, label: state.name }))}
        value={form.state}
        onSelect={(value) => {
          setForm({ ...form, state: value, city: '' }); // Reset city when state changes
        }}
        placeholder="Select state"
      />

      {form.state && (
        <Dropdown
          label="City"
          required
          options={(US_CITIES_BY_STATE[form.state] || []).map(city => ({ value: city, label: city }))}
          value={form.city}
          onSelect={(value) => setForm({ ...form, city: value })}
          placeholder="Select city"
        />
      )}
    </View>
  );

  const renderHealth = () => (
    <View style={styles.stepContent}>
      <View style={[styles.section, { backgroundColor: '#FFF4E6', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FFA500' }]}>
        <Text style={[styles.label, { color: '#B45309', marginBottom: 8 }]}>⚠️ Important Notice</Text>
        <Text style={[styles.description, { color: '#92400E', fontSize: 13 }]}>
          Listings <Text style={{ fontWeight: '700' }}>without veterinary documentation</Text> will be labeled as "Unverified" and buyers will see a warning to proceed at their own risk.
          Adding health documents builds trust and improves listing visibility.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Health Documents</Text>
        <Text style={[styles.uploadText, { marginBottom: 12 }]}>
          Upload veterinary documents, vaccination records, and health certifications (Optional but strongly recommended)
        </Text>
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handlePickDocuments}
        >
          <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.uploadText}>
            Tap to upload documents (PDF, PNG, JPG)
          </Text>
          <Text style={[styles.uploadText, { fontSize: 12, marginTop: 4 }]}>
            Up to 10MB each
          </Text>
        </TouchableOpacity>

        {healthDocuments.length > 0 && (
          <View style={styles.imagesGrid}>
            {healthDocuments.map((doc, index) => (
              <View key={index} style={[styles.imageContainer, { backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5' }]}>
                <Ionicons name="document-text" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={[styles.uploadText, { fontSize: 11 }]} numberOfLines={2}>
                  {doc.name}
                </Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveDocument(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
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
          disabled={selectedImages.length >= 10}
        >
          <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.uploadText}>
            {selectedImages.length >= 10 
              ? 'Maximum images reached (10)' 
              : `Tap to upload images (${selectedImages.length}/10)`}
          </Text>
        </TouchableOpacity>

        {selectedImages.length > 0 && (
          <View style={styles.imagesGrid}>
            {selectedImages.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image 
                  source={{ uri: image.uri }} 
                  style={styles.image} 
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
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
        <Text style={styles.reviewLabel}>Breed</Text>
        <Text style={styles.reviewValue}>{form.breed || 'N/A'}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Category</Text>
        <Text style={styles.reviewValue}>
          {categories.find(c => c.id === form.category)?.name || 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Listing Type</Text>
        <Text style={styles.reviewValue}>
          {listingTypes.find(t => t.value === form.listing_type)?.label || 'N/A'}
        </Text>
      </View>

      {form.listing_type === 'sale' && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Price</Text>
          <Text style={styles.reviewValue}>${form.price || '0.00'}</Text>
        </View>
      )}

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Location</Text>
        <Text style={styles.reviewValue}>
          {form.city && form.state 
            ? `${form.city}, ${US_STATES.find(s => s.code === form.state)?.name || form.state}` 
            : 'N/A'}
        </Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Health Documents</Text>
        <Text style={styles.reviewValue}>
          {healthDocuments.length > 0 ? `${healthDocuments.length} document(s)` : 'None (Optional)'}
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
      case 'pricing':
        return renderPricing();
      case 'health':
        return renderHealth();
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
    stepTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    stepSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
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
          router.push('/(tabs)/animals');
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
              !canProceed() && styles.submitButtonDisabled,
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
              (submitting || !canProceed()) && styles.submitButtonDisabled,
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
