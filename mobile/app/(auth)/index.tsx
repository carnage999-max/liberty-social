import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { LoginRequest, RegisterRequest, AuthTokens } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import AppNavbar from '../../components/layout/AppNavbar';

type AuthMode = 'login' | 'register';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  
  // Register state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    username: '',
    phone_number: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const switchMode = (newMode: AuthMode) => {
    if (newMode === mode) return;
    
    // Animate out
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: newMode === 'register' ? -SCREEN_WIDTH : SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMode(newMode);
      // Reset position for new content
      slideAnim.setValue(newMode === 'register' ? SCREEN_WIDTH : -SCREEN_WIDTH);
      // Animate in
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleLogin = async () => {
    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const loginData: LoginRequest = { username, password };
      const tokens = await apiClient.post<AuthTokens>('/auth/login/', loginData);

      await login(tokens);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name || !formData.username) {
      showError('Please fill in all required fields');
      return;
    }

    if (formData.password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const registerData: RegisterRequest = {
        ...formData,
        phone_number: formData.phone_number || null,
      };
      const tokens = await apiClient.post<AuthTokens>('/auth/register/', registerData);

      await login(tokens);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      showError(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      showError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      showError('Please enter a valid email address');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      await apiClient.post('/auth/password-reset/', { email: forgotPasswordEmail });
      showSuccess('If an account exists with this email, you will receive reset instructions shortly');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error: any) {
      // Don't show error - backend doesn't reveal if email exists
      showSuccess('If an account exists with this email, you will receive reset instructions shortly');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 16,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 12,
      padding: 4,
      marginBottom: 32,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    formContainer: {
      width: SCREEN_WIDTH - 48,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
    },
    input: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    passwordInput: {
      flex: 1,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    passwordToggle: {
      padding: 16,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginTop: -8,
      marginBottom: 16,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 24,
      width: SCREEN_WIDTH - 48,
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    modalButtonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalCancelButton: {
      flex: 1,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalCancelText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    modalSubmitButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalSubmitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const renderLoginForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to continue to Liberty Social</Text>

      <Text style={styles.label}>Username, Email, or Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your username, email, or phone"
        placeholderTextColor={colors.textSecondary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Enter your password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.forgotPasswordLink}
        onPress={() => setShowForgotPassword(true)}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRegisterForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Liberty Social today</Text>

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="First name"
          placeholderTextColor={colors.textSecondary}
          value={formData.first_name}
          onChangeText={(text) => setFormData({ ...formData, first_name: text })}
          editable={!loading}
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="Last name"
          placeholderTextColor={colors.textSecondary}
          value={formData.last_name}
          onChangeText={(text) => setFormData({ ...formData, last_name: text })}
          editable={!loading}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.textSecondary}
        value={formData.username}
        onChangeText={(text) => setFormData({ ...formData, username: text })}
        autoCapitalize="none"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone number (optional)"
        placeholderTextColor={colors.textSecondary}
        value={formData.phone_number}
        onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
        keyboardType="phone-pad"
        editable={!loading}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          secureTextEntry={!showPassword}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm password"
          placeholderTextColor={colors.textSecondary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Ionicons
            name={showConfirmPassword ? 'eye-off' : 'eye'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Sign Up'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Liberty Social" 
        showLogo={true}
        showProfileImage={false}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.activeTab]}
              onPress={() => switchMode('login')}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.activeTab]}
              onPress={() => switchMode('register')}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Animated Form Container */}
          <Animated.View
            style={{
              opacity: opacityAnim,
              transform: [{ translateX: slideAnim }],
            }}
          >
            {mode === 'login' ? renderLoginForm() : renderRegisterForm()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Forgot Password?</Text>
            <Text style={styles.modalSubtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              value={forgotPasswordEmail}
              onChangeText={setForgotPasswordEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!forgotPasswordLoading}
              autoFocus={true}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail('');
                }}
                disabled={forgotPasswordLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, forgotPasswordLoading && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={forgotPasswordLoading}
              >
                <Text style={styles.modalSubmitText}>
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


