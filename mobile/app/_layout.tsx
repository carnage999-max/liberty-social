import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AlertProvider } from '../contexts/AlertContext';
import { ToastProvider } from '../contexts/ToastContext';
import { MessageBadgeProvider } from '../contexts/MessageBadgeContext';
import { TypingStatusProvider } from '../contexts/TypingStatusContext';
import { CallProvider } from '../contexts/CallContext';
import { IncomingCallModal } from '../components/calls/IncomingCallModal';
import { OutgoingCallModal } from '../components/calls/OutgoingCallModal';
import { ActiveCallModal } from '../components/calls/ActiveCallModal';
import { StatusBar } from 'expo-status-bar';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLocationTracking } from '../hooks/useLocationTracking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { initStripe } from '@stripe/stripe-react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Initialize Stripe with your publishable key
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

if (stripePublishableKey) {
  initStripe({
    publishableKey: stripePublishableKey,
  }).catch(err => console.warn('Stripe init error:', err));
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const { isLoading } = useAuth();
  const [appIsReady, setAppIsReady] = useState(false);
  usePushNotifications();
  useLocationTracking(); // Track user location on app startup
  // NOTE: WebSocket for calls will be integrated with existing chat WebSocket
  // For now, CallContext is available but WebSocket signaling can be added later

  useEffect(() => {
    async function prepare() {
      try {
        // Wait for auth to finish loading
        if (!isLoading) {
          // Small delay to ensure smooth transition and let initial render complete
          await new Promise(resolve => setTimeout(resolve, 300));
          setAppIsReady(true);
        }
      } catch (e) {
        console.warn(e);
        setAppIsReady(true);
      }
    }

    if (!isLoading) {
      prepare();
    }
  }, [isLoading]);

  useEffect(() => {
    if (appIsReady) {
      // Hide splash screen with a fade animation
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    // Return null to keep splash screen visible
    // The splash screen background color matches app.json splash backgroundColor
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <AlertProvider>
            <ToastProvider>
              <MessageBadgeProvider>
                <TypingStatusProvider>
                  <CallProvider>
                    <RootLayoutNav />
                    <IncomingCallModal />
                    <OutgoingCallModal />
                    <ActiveCallModal />
                  </CallProvider>
                </TypingStatusProvider>
              </MessageBadgeProvider>
            </ToastProvider>
          </AlertProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

