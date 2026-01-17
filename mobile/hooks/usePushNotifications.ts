import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/api';

// Check if we're in a development build (not Expo Go)
const isDevBuild = Constants.appOwnership === 'standalone' || Constants.appOwnership === 'expo';
const isExpoGo = !Constants.expoConfig?.plugins?.some((p: any) => 
  typeof p === 'object' && p[0] === 'expo-notifications'
);

// Only import and configure notifications if not in Expo Go
let Notifications: any = null;
let notificationsAvailable = false;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    notificationsAvailable = true;
    
    // Configure notification handler - matches Expo documentation exactly
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('Notifications not available in this build', error);
    notificationsAvailable = false;
  }
}

export function usePushNotifications() {
  const { user, accessToken } = useAuth();
  const notificationListener = useRef<any | null>(null);
  const responseListener = useRef<any | null>(null);

  useEffect(() => {
    if (!notificationsAvailable) {
      console.log('Push notifications not available in Expo Go. Will work in development builds.');
      return;
    }

    if (!user || !accessToken) {
      console.log('Push notifications: Waiting for user/auth...');
      return;
    }
    
    console.log('Initializing push notifications for user:', user.id);

    // Request permissions
    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        console.log('Expo push token obtained:', token.substring(0, 30) + '...');
        // Register token with backend
        try {
          const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
          console.log('Registering device token with platform:', platform);
          const response = await apiClient.post(
            '/device-tokens/',
            {
              token,
              platform,
            }
          );
          console.log('Device token registered successfully:', response.data);
        } catch (error: any) {
          // Check if the error is because the token already exists (400 with specific message)
          const errorData = error?.response?.data;
          const isTokenExistsError = error?.response?.status === 400 && 
            (errorData?.token?.some((msg: string) => msg.includes('already exists')) ||
             errorData?.detail?.includes('already exists'));
          
          if (isTokenExistsError) {
            // Token already registered - this is fine, just log it
            console.log('Device token already registered - skipping');
          } else {
            // Actual error - log it
            console.error('Failed to register device token:', error);
            console.error('Error details:', errorData || error?.message);
          }
        }
      } else {
        console.warn('No Expo push token obtained - push notifications will not work');
      }
    }).catch((error) => {
      console.error('Error in registerForPushNotificationsAsync:', error);
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log('Notification response:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.target_url) {
        // Navigate to target URL if needed
      }
    });

    return () => {
      // Clean up notification listeners (only if notifications are available)
      if (notificationsAvailable && Notifications) {
        if (notificationListener.current) {
          // Remove notification listener by calling .remove() on the subscription
          notificationListener.current.remove?.();
          notificationListener.current = null;
        }
        
        if (responseListener.current) {
          // Remove response listener by calling .remove() on the subscription
          responseListener.current.remove?.();
          responseListener.current = null;
        }
      }
    };
  }, [user, accessToken]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!notificationsAvailable || !Notifications) {
    console.log('Push notifications not available in this build');
    return null;
  }

  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification! Permission status:', finalStatus);
    return null;
  }
  
  console.log('Notification permissions granted:', finalStatus);

  try {
    // Get project ID from Constants - required for EAS builds
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('No projectId found in app.json. Push notifications require a projectId.');
      console.error('Add it to app.json: "extra": { "eas": { "projectId": "your-project-id" } }');
      return null;
    }
    
    console.log('Getting Expo push token with projectId:', projectId);
    
    // Add a small delay to ensure Firebase is fully initialized
    // This is a workaround for timing issues
    await new Promise(resolve => setTimeout(resolve, 500));
    
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo push token obtained successfully, length:', token?.length);
  } catch (error: any) {
    console.error('Error getting push token:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    
    if (error?.message?.includes('FirebaseApp') || error?.message?.includes('Firebase')) {
      console.error('Firebase initialization error detected.');
      console.error('This usually means Firebase is not properly initialized.');
      console.error('Check that google-services.json is present and valid.');
    } else if (error?.message?.includes('projectId')) {
      console.error(
        'Push notifications require a projectId. Add it to app.json:\n' +
        '  "extra": { "eas": { "projectId": "your-project-id" } }'
      );
    }
  }

  return token;
}


