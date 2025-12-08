import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/api';

// Check if we're in Expo Go (push notifications not supported)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Only import Notifications if not in Expo Go
let Notifications: typeof import('expo-notifications') | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('expo-notifications not available:', error);
  }
}

export function usePushNotifications() {
  const { user, accessToken } = useAuth();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!user || !accessToken) {
      console.log('Push notifications: Waiting for user/auth...');
      return;
    }
    
    // Skip push notifications in Expo Go
    if (isExpoGo || !Notifications) {
      console.log('Push notifications not available in Expo Go. Use a development build for push notifications.');
      console.log('Execution environment:', Constants.executionEnvironment);
      console.log('Notifications available:', !!Notifications);
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
          console.error('Failed to register device token:', error);
          console.error('Error details:', error?.response?.data || error?.message);
        }
      } else {
        console.warn('No Expo push token obtained - push notifications will not work');
      }
    }).catch((error) => {
      console.error('Error in registerForPushNotificationsAsync:', error);
    });

    // Listen for notifications received while app is foregrounded
    if (Notifications) {
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received:', notification);
      });

      // Listen for user tapping on notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification response:', response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        if (data?.target_url) {
          // Navigate to target URL if needed
        }
      });
    }

    return () => {
      if (Notifications && notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (Notifications && responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user, accessToken]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) {
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
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  try {
    // Get project ID from Constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (projectId) {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      // Try without projectId (works in managed workflow with Expo Go)
      // For production builds, projectId is required
      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } catch (err: any) {
        if (err?.message?.includes('projectId')) {
          console.warn(
            'Push notifications require a projectId. Add it to app.json:\n' +
            '  "extra": { "eas": { "projectId": "your-project-id" } }'
          );
          throw err;
        }
        throw err;
      }
    }
  } catch (error: any) {
    console.error('Error getting push token:', error);
    // If projectId is missing, log helpful message
    if (error?.message?.includes('projectId')) {
      console.warn(
        'Push notifications require a projectId. Add it to app.json:\n' +
        '  "extra": { "eas": { "projectId": "your-project-id" } }'
      );
    }
  }

  return token;
}

