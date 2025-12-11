import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/api';

// Configure notification handler - matches Expo documentation exactly
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user, accessToken } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
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
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.target_url) {
        // Navigate to target URL if needed
      }
    });

    return () => {
      // Clean up notification listeners
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
        notificationListener.current = null;
      }
      
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
        responseListener.current = null;
      }
    };
  }, [user, accessToken]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
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
    
    if (projectId) {
      console.log('Getting Expo push token with projectId:', projectId);
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo push token obtained successfully');
    } else {
      // Fallback: try without projectId (may work in some cases)
      console.warn('No projectId found in app.json. Push notifications may not work.');
      token = (await Notifications.getExpoPushTokenAsync()).data;
    }
  } catch (error: any) {
    console.error('Error getting push token:', error);
    if (error?.message?.includes('projectId')) {
      console.error(
        'Push notifications require a projectId. Add it to app.json:\n' +
        '  "extra": { "eas": { "projectId": "your-project-id" } }'
      );
    }
  }

  return token;
}


