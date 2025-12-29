import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';
import { Ionicons } from '@expo/vector-icons';

export default function CreateYardSale() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();

  type Step = 'basic' | 'schedule' | 'location' | 'review';
  const steps: { id: Step; label: string; description: string }[] = [
    { id: 'basic', label: 'Basic Info', description: 'Title, description' },
    { id: 'schedule', label: 'Dates', description: 'Start / End dates, hours' },
    { id: 'location', label: 'Location', description: 'Address and map' },
    { id: 'review', label: 'Review', description: 'Preview & pay' },
  ];

  const stepIcons: Record<Step, string> = {
    basic: 'create-outline',
    schedule: 'calendar-outline',
    location: 'location-outline',
    review: 'checkmark-done-outline',
  };

  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    hours: '9am - 4pm',
    address: '',
    phone: '',
  });

useEffect(() => {
    (global as any).hideTabBar?.();
    return () => {
      (global as any).showTabBar?.();
    };
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(form.title && form.description);
      case 'schedule':
        return !!(form.start_date && form.end_date);
      case 'location':
        return !!form.address;
      case 'media':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goToStep = (step: Step) => {
    const stepIndex = steps.findIndex((s) => s.id === step);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex <= currentIndex || canProceed()) setCurrentStep(step);
  };

  const handleNext = () => {
    if (!canProceed()) {
      showError('Please fill required fields to continue');
      return;
    }
    const idx = steps.findIndex((s) => s.id === currentStep);
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id as Step);
  };

  const handlePrevious = () => {
    const idx = steps.findIndex((s) => s.id === currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1].id as Step);
  };



  const handleCheckout = async () => {
    if (!canProceed()) {
      showError('Please fill required fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}`);
      const data = await res.json();
      if (!data || data.length === 0) {
        showError('Address not found. Please refine the address.');
        setSubmitting(false);
        return;
      }
      const { lat, lon } = data[0];

      const payload = {
        ...form,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        images: selectedImages.map(i => i.uri),
      };

      const encoded = encodeURIComponent(JSON.stringify(payload));
      setSubmitting(false);
      router.push(`/yard-sales/payment?payload=${encoded}`);
    } catch (err: any) {
      console.error('Checkout error', err);
      showError(err?.message || 'Failed to prepare payment');
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    const currentData = steps[currentIndex];

    return (
      <View style={styles.stepIndicator}>
        <View style={styles.stepIndicatorContent}>
          <View style={styles.stepNumbersRow}>
            {steps.map((s, i) => {
              const isActive = i === currentIndex;
              const isCompleted = i < currentIndex;
              const iconColor = isActive ? '#1a2335' : isCompleted ? '#fff' : colors.textSecondary;

              return (
                <React.Fragment key={s.id}>
                  <TouchableOpacity
                    style={styles.stepNumberButton}
                    onPress={() => goToStep(s.id)}
                    disabled={i > currentIndex && !canProceed()}
                  >
                    <Ionicons name={stepIcons[s.id]} size={16} color={iconColor} style={{ marginBottom: 6 }} />

                    <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isCompleted && styles.stepCircleCompleted]}>
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      ) : (
                        <Text style={[styles.stepNumber, isActive && styles.stepNumberActive, { color: isActive ? colors.text : colors.textSecondary }]}>{i + 1}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {i < steps.length - 1 && <View style={[styles.stepConnector, isCompleted && styles.stepConnectorCompleted]} />}
                </React.Fragment>
              );
            })}
          </View>

          <View style={styles.stepTitleContainer}>
            <Text style={[styles.stepTitleText, { color: colors.text }]}>Step {currentIndex + 1}: {currentData.label}</Text>
            <Text style={[styles.stepSubtitleText, { color: colors.textSecondary }]}>{currentData.description}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBasic = () => (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          value={form.title}
          onChangeText={(t) => setForm({ ...form, title: t })}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your yard sale"
          placeholderTextColor={colors.textSecondary}
          multiline
          value={form.description}
          onChangeText={(t) => setForm({ ...form, description: t })}
        />
      </View>
    </View>
  );

  const renderSchedule = () => (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Start Date <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          value={form.start_date}
          onChangeText={(t) => setForm({ ...form, start_date: t })}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>End Date <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
          value={form.end_date}
          onChangeText={(t) => setForm({ ...form, end_date: t })}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Hours</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 9am - 4pm"
          placeholderTextColor={colors.textSecondary}
          value={form.hours}
          onChangeText={(t) => setForm({ ...form, hours: t })}
        />
      </View>
    </View>
  );

  const renderLocation = () => (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Address <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Street, City, State"
          placeholderTextColor={colors.textSecondary}
          value={form.address}
          onChangeText={(t) => setForm({ ...form, address: t })}
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>We'll geocode this address when you continue to payment.</Text>
      </View>
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Preview</Text>
        <View style={[styles.previewCard, { backgroundColor: isDark ? '#0b1220' : '#fff' } as any]}>
          <Text style={{ fontWeight: '700' }}>{form.title || 'Untitled'}</Text>
          <Text style={{ color: '#666' }}>{form.address}</Text>
          <Text style={{ color: '#666', marginTop: 6 }}>{form.start_date} — {form.end_date}</Text>
          <Text style={{ color: '#666', marginTop: 6 }}>{form.hours}</Text>
          <Text style={{ color: '#666', marginTop: 6 }}>{form.description}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Listing Fee</Text>
        <Text style={{ fontWeight: '700' }}>$0.99</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.primaryBtn, submitting ? styles.submitDisabled : {}]}
          onPress={handleCheckout}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Pay $0.99 & Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <AppNavbar
        title="Post a Yard Sale"
        showLogo={false}
        showProfileImage={false}
        showBackButton={true}
        onBackPress={() => router.push('/(tabs)/yard-sales')}
      />

      {renderStepIndicator()}

      <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 16 }}>
        {currentStep === 'basic' && renderBasic()}
        {currentStep === 'schedule' && renderSchedule()}
        {currentStep === 'location' && renderLocation()}
        {currentStep === 'review' && renderReview()}
      </ScrollView>

      <View style={styles.navigationButtons}>
        <TouchableOpacity onPress={handlePrevious} disabled={steps.findIndex(s => s.id === currentStep) === 0} style={[styles.navButton, styles.navButtonSecondary]}>
          <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>

        {steps[steps.length -1].id !== currentStep ? (
          <TouchableOpacity onPress={handleNext} style={[styles.navButton, styles.navButtonPrimary]}>
            <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>Next</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  stepIndicator: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 16, paddingTop: 8 },
  stepIndicatorContent: { paddingVertical: 10 },
  stepNumbersRow: { flexDirection: 'row', alignItems: 'center' },
  stepNumberButton: { padding: 6 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#C8A25F' },
  stepCircleCompleted: { backgroundColor: '#1a2335' },
  stepNumber: { color: '#666' },
  stepNumberActive: { color: '#fff', fontWeight: '700' },
  stepConnector: { height: 2, flex: 1, backgroundColor: '#eee', marginHorizontal: 8 },
  stepConnectorCompleted: { backgroundColor: '#C8A25F' },
  stepTitleContainer: { marginTop: 8 },
  stepTitleText: { fontWeight: '700' },
  stepSubtitleText: { color: '#666' },
  stepContent: { paddingHorizontal: 0, paddingVertical: 12 },
  section: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  required: { color: '#D7263D' },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' as any },
  hint: { fontSize: 12, color: '#666', marginTop: 6 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' as any },
  thumbWrap: { width: 88, height: 88, marginRight: 8, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 6, right: 6 },
  addPhoto: { width: 88, height: 88, borderRadius: 8, borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { fontSize: 12, color: '#666', marginTop: 6 },
  previewCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  navigationButtons: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  navButton: { padding: 12, borderRadius: 8, minWidth: 120, alignItems: 'center' },
  navButtonPrimary: { backgroundColor: '#192A4A' },
  navButtonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  navButtonText: { color: '#1a2335', fontWeight: '700' },
  navButtonTextPrimary: { color: '#fff' },
  primaryBtn: { padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#192A4A' },
  primaryText: { color: '#fff', fontWeight: '700' },
  submitDisabled: { opacity: 0.6 },
});
