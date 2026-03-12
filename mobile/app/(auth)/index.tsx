import React, { useState, useRef, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../utils/api';
import { openInAppBrowser } from '../../utils/inAppBrowser';
import { LoginRequest, RegisterRequest, AuthTokens } from '../../types';
import { getPasskeyLoginLabel, usePasskey } from '../../hooks/usePasskey';
import { Ionicons } from '@expo/vector-icons';
import AppNavbar from '../../components/layout/AppNavbar';

type AuthMode = 'login' | 'register';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
WebBrowser.maybeCompleteAuthSession();

// Frontend color constants
const COLOR_GOLD = '#C8A25F';
const COLOR_DEEP_NAVY = '#1D2B4F';
const COLOR_DEEPER_NAVY = '#121A33';

type AppleAuthModule = typeof import('expo-apple-authentication');
let cachedAppleAuthModule: AppleAuthModule | null | undefined;

function getAppleAuthModule(): AppleAuthModule | null {
  if (cachedAppleAuthModule !== undefined) {
    return cachedAppleAuthModule;
  }
  try {
    // Load lazily so this screen does not crash when the binary is missing the native module.
    cachedAppleAuthModule = require('expo-apple-authentication');
  } catch (error) {
    cachedAppleAuthModule = null;
  }
  return cachedAppleAuthModule;
}

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  
  // Passkey authentication
  const {
    authenticate: authenticatePasskey,
    isAvailable: isPasskeyAvailable,
    loading: passkeyLoading,
    isPasskeyCancellationError,
  } = usePasskey();
  const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);
  const params = useLocalSearchParams();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as AuthMode;
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';
  
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
  const googleConfigured =
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) ||
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) ||
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return;
    }

    const appleAuth = getAppleAuthModule();
    if (!appleAuth) {
      setAppleAvailable(false);
      return;
    }

    appleAuth.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const completeGoogleLogin = async () => {
      if (googleResponse?.type !== 'success') {
        if (googleResponse?.type && googleResponse.type !== 'success') {
          setGoogleLoading(false);
        }
        return;
      }

      const idToken =
        (googleResponse.params as Record<string, string | undefined> | undefined)?.id_token ??
        (googleResponse.authentication as { idToken?: string } | null)?.idToken;

      if (!idToken) {
        if (!cancelled) {
          setGoogleLoading(false);
          showError('Google sign-in did not return an ID token.');
        }
        return;
      }

      try {
        const tokens = await apiClient.post<AuthTokens>('/auth/google/auth/', {
          id_token: idToken,
        });
        if (cancelled) return;
        await login(tokens);
        router.replace('/(tabs)/feed');
      } catch (error: any) {
        if (!cancelled) {
          showError(error?.response?.data?.detail || 'Google sign-in failed.');
        }
      } finally {
        if (!cancelled) {
          setGoogleLoading(false);
        }
      }
    };

    completeGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [googleResponse, login, router, showError]);

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

  const handlePasskeyLogin = async () => {
    if (isExpoGo) {
      showError('Passkeys require a development or production build. Expo Go does not include the native passkey module.');
      return;
    }
    if (!isPasskeyAvailable) {
      showError('Passkeys are not available on this device');
      return;
    }

    setAuthenticatingPasskey(true);
    try {
      const tokens = await authenticatePasskey();
      await login(tokens);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      if (error?.message === 'PASSKEY_CANCELLED' || isPasskeyCancellationError(error)) {
        return;
      }
      showError(error?.message || 'Failed to authenticate with passkey. Please try again.');
    } finally {
      setAuthenticatingPasskey(false);
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

  const handleGoogleLogin = async () => {
    if (isExpoGo) {
      showError('Google sign-in requires a development or production build. Expo Go uses a different app identity.');
      return;
    }
    if (!googleConfigured) {
      showError('Google sign-in is not configured for this build.');
      return;
    }

    if (!googleRequest) {
      showError('Google sign-in is still preparing. Please try again.');
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptGoogleAuth();
      if (result.type !== 'success') {
        setGoogleLoading(false);
      }
    } catch (error) {
      setGoogleLoading(false);
      showError('Unable to start Google sign-in.');
    }
  };

  const handleAppleLogin = async () => {
    if (isExpoGo) {
      showError('Apple sign-in requires a development or production build. Expo Go does not use your app bundle identity.');
      return;
    }
    const appleAuth = getAppleAuthModule();
    if (Platform.OS !== 'ios' || !appleAvailable || !appleAuth) {
      showError('Apple Sign In is not available on this device.');
      return;
    }

    setAppleLoading(true);
    try {
      const credential = await appleAuth.signInAsync({
        requestedScopes: [
          appleAuth.AppleAuthenticationScope.FULL_NAME,
          appleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple Sign In did not return an identity token.');
      }

      const tokens = await apiClient.post<AuthTokens>('/auth/apple/auth/', {
        identity_token: credential.identityToken,
        email: credential.email,
        first_name: credential.fullName?.givenName,
        last_name: credential.fullName?.familyName,
      });

      await login(tokens);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      showError(error?.response?.data?.detail || error?.message || 'Apple sign-in failed.');
    } finally {
      setAppleLoading(false);
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
      backgroundColor: isDark ? colors.background : '#F6F7FB',
    },
    scrollContent: {
      flexGrow: 1,
      padding: 16,
      paddingTop: 16,
    },
    // Tab switcher - matching frontend
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      padding: 4,
      marginBottom: 24,
      overflow: 'hidden',
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: COLOR_DEEP_NAVY,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#75829a',
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    formContainer: {
      width: '100%',
    },
    // Form card - matching frontend gradient card
    formCard: {
      borderRadius: 16,
      padding: 20,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.95)',
      // Shadow effect
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : COLOR_DEEP_NAVY,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#6B7280',
      marginBottom: 24,
    },
    // Input styling - less glaring with softer background
    input: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)',
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: isDark ? '#FFFFFF' : '#1F2937',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(200, 162, 95, 0.25)' : 'rgba(200, 162, 95, 0.35)',
      marginBottom: 16,
    },
    inputFocused: {
      borderColor: COLOR_GOLD,
      borderWidth: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)',
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(200, 162, 95, 0.25)' : 'rgba(200, 162, 95, 0.35)',
      marginBottom: 16,
    },
    passwordContainerFocused: {
      borderColor: COLOR_GOLD,
      borderWidth: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)',
    },
    passwordInput: {
      flex: 1,
      padding: 12,
      fontSize: 15,
      color: isDark ? '#FFFFFF' : '#1F2937',
    },
    passwordToggle: {
      padding: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
    // Button - matching frontend btn-primary
    button: {
      backgroundColor: COLOR_DEEP_NAVY,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonPasskey: {
      backgroundColor: COLOR_GOLD,
      marginTop: 12,
    },
    buttonGoogle: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D9DEE8',
      marginTop: 12,
    },
    buttonApple: {
      backgroundColor: '#111111',
      marginTop: 12,
    },
    passkeyHint: {
      marginTop: 8,
      marginBottom: 4,
      fontSize: 13,
      lineHeight: 18,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#5B6472',
      textAlign: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextDark: {
      color: COLOR_DEEP_NAVY,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? 'rgba(255, 255, 255, 0.85)' : COLOR_DEEP_NAVY,
      marginBottom: 8,
    },
    forgotPasswordLink: {
      alignSelf: 'flex-end',
      marginTop: -8,
      marginBottom: 16,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: isDark ? COLOR_GOLD : COLOR_DEEP_NAVY,
      fontWeight: '600',
    },
    termsText: {
      fontSize: 12,
      color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#6B7280',
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    termsLink: {
      color: COLOR_GOLD,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.background : '#F6F7FB',
      borderRadius: 16,
      padding: 24,
      width: SCREEN_WIDTH - 48,
      maxWidth: 400,
      borderWidth: 1,
      borderColor: COLOR_GOLD,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : COLOR_DEEP_NAVY,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#6B7280',
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
      backgroundColor: COLOR_DEEP_NAVY,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    modalSubmitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    errorText: {
      fontSize: 12,
      color: '#EF4444',
      marginTop: -12,
      marginBottom: 8,
    },
  });

  const renderLoginForm = () => {
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    return (
      <View style={styles.formCard}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue to Liberty Social</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[
            styles.input,
            focusedInput === 'identifier' && styles.inputFocused,
          ]}
          placeholder="your@email.com"
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={setUsername}
          onFocus={() => setFocusedInput('identifier')}
          onBlur={() => setFocusedInput(null)}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <View
          style={[
            styles.passwordContainer,
            focusedInput === 'password' && styles.passwordContainerFocused,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="********"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
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
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotPasswordLink}
          onPress={() => setShowForgotPassword(true)}
        >
          <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
        </TouchableOpacity>

        {googleConfigured ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonGoogle, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={googleLoading || !googleRequest || isExpoGo}
          >
            <Ionicons name="logo-google" size={20} color="#1F2937" style={{ marginRight: 8 }} />
            <Text style={[styles.buttonText, styles.buttonTextDark]}>
              {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {Platform.OS === 'ios' && appleAvailable ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonApple, appleLoading && styles.buttonDisabled]}
            onPress={handleAppleLogin}
            disabled={appleLoading || isExpoGo}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>
              {appleLoading ? 'Connecting to Apple...' : 'Continue with Apple'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Passkey login button */}
        {isPasskeyAvailable && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.buttonPasskey, (authenticatingPasskey || passkeyLoading) && styles.buttonDisabled]}
              onPress={handlePasskeyLogin}
              disabled={authenticatingPasskey || passkeyLoading || isExpoGo}
            >
              <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>
                {authenticatingPasskey || passkeyLoading ? 'Authenticating...' : getPasskeyLoginLabel()}
              </Text>
            </TouchableOpacity>
            <Text style={styles.passkeyHint}>
              {Platform.OS === 'ios'
                ? 'Use Face ID, Touch ID, or an iCloud Keychain passkey saved for Liberty Social.'
                : 'Use a saved passkey from your device password manager.'}
            </Text>
          </>
        )}

      </View>
    );
  };

  const renderRegisterForm = () => {
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    return (
      <View style={styles.formCard}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Liberty Social today</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="First name"
            placeholderTextColor="#9CA3AF"
            value={formData.first_name}
            onChangeText={(text) => setFormData({ ...formData, first_name: text })}
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Last name"
            placeholderTextColor="#9CA3AF"
            value={formData.last_name}
            onChangeText={(text) => setFormData({ ...formData, last_name: text })}
            editable={!loading}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#9CA3AF"
          value={formData.username}
          onChangeText={(text) => setFormData({ ...formData, username: text })}
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone number (optional)"
          placeholderTextColor="#9CA3AF"
          value={formData.phone_number}
          onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
          keyboardType="phone-pad"
          editable={!loading}
        />

        <View
          style={[
            styles.passwordContainer,
            focusedInput === 'password' && styles.passwordContainerFocused,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
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
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.passwordContainer,
            focusedInput === 'confirm' && styles.passwordContainerFocused,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm password"
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setFocusedInput('confirm')}
            onBlur={() => setFocusedInput(null)}
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
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* Terms and Privacy Notice */}
        <Text style={styles.termsText}>
          By clicking "Create account" you agree to our{' '}
          <Text 
            style={styles.termsLink}
            onPress={() => openInAppBrowser('https://mylibertysocial.com/terms')}
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text 
            style={styles.termsLink}
            onPress={() => openInAppBrowser('https://mylibertysocial.com/privacy')}
          >
            Privacy Policy
          </Text>
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Create account'}</Text>
        </TouchableOpacity>

      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppNavbar 
        title="Liberty Social" 
        showLogo={true}
        showProfileImage={false}
        showSearchIcon={false}
        showMessageIcon={false}
        logoRoute="/welcome"
        showBackButton={true}
        onBackPress={() => router.push('/welcome')}
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
                Log in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.activeTab]}
              onPress={() => switchMode('register')}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>
                Sign up
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
