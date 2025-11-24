import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';

export default function CreatePageScreen() {
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'business',
    website_url: '',
    phone: '',
    email: '',
  });

  const handleSubmit = async () => {
    if (!form.name) {
      showError('Please enter a page name');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/pages/', form);
      showSuccess('Page created successfully!');
      router.back();
    } catch (error) {
      showError('Failed to create page');
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
  });

  return (
    <View style={styles.container}>
      <AppNavbar showProfileImage={false} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
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
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
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

