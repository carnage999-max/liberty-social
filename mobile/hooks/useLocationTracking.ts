/**
 * useLocationTracking Hook
 * 
 * Handles user geolocation detection with GPS and IP-based fallback.
 * Automatically sends location data to the backend.
 * 
 * Features:
 * - Requests GPS permission (if not already granted)
 * - Falls back to IP-based geolocation if GPS unavailable
 * - Sends location data to backend on app startup
 * - Handles errors gracefully
 * - Won't spam requests (tracks if already updated in session)
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.mylibertysocial.com/api';

interface LocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
}

interface LocationResponse {
  success: boolean;
  source: string;
  location: Record<string, any>;
  updated_fields: string[];
}

/**
 * Get the user's authentication token from storage
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    return token || null;
  } catch (error: unknown) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Send location data to backend
 */
async function sendLocationToBackend(
  locationData: LocationData,
  token: string | null
): Promise<boolean> {
  if (!token) {
    console.warn('No auth token available, skipping location update');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/update-location/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(locationData),
    });

    if (response.ok) {
      const data = (await response.json()) as LocationResponse;
      console.log('✓ Location updated successfully:', {
        source: data.source,
        updatedFields: data.updated_fields,
      });
      return true;
    } else if (response.status === 401) {
      console.warn('Unauthorized - user token may be invalid');
      return false;
    } else {
      console.warn('Failed to update location:', response.status);
      return false;
    }
  } catch (error: unknown) {
    console.error('Error sending location to backend:', error);
    return false;
  }
}

/**
 * Hook for tracking user location
 * Call this in your root component (app/_layout.tsx or app.tsx)
 */
export function useLocationTracking() {
  const locationUpdateAttempted = useRef(false);

  useEffect(() => {
    // Only try once per app session
    if (locationUpdateAttempted.current) {
      return;
    }
    locationUpdateAttempted.current = true;

    const trackLocation = async () => {
      try {
        // First, try to get GPS location
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          // Request permission if not already granted
          const { status } = await Location.requestForegroundPermissionsAsync();
          finalStatus = status;
        }

        const locationData: LocationData = {};

        if (finalStatus === 'granted') {
          // GPS permission granted - get precise location
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });

            locationData.latitude = location.coords.latitude;
            locationData.longitude = location.coords.longitude;
            locationData.accuracy = location.coords.accuracy;

            console.log('✓ GPS location obtained:', {
              lat: location.coords.latitude,
              lon: location.coords.longitude,
              accuracy: location.coords.accuracy,
            });
          } catch (gpsError: unknown) {
            console.warn('GPS location failed:', gpsError);
            // Fall through to IP-based fallback
          }
        } else {
          console.log('GPS permission denied, will use IP-based location');
        }

        // Get auth token and send to backend
        // If GPS wasn't obtained, backend will fall back to IP geolocation
        const token = await getAuthToken();
        await sendLocationToBackend(locationData, token);
      } catch (error: unknown) {
        console.error('Location tracking error:', error);
        // Fail silently - don't break the app
      }
    };

    // Give app time to load before requesting permissions
    const timeout = setTimeout(trackLocation, 1000);

    return () => clearTimeout(timeout);
  }, []);
}

export default useLocationTracking;
