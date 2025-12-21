'use client';

import { useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface LocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

/**
 * Get the user's authentication token from localStorage
 */
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('liberty_auth_v1');
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    return parsed?.accessToken || null;
  } catch (error) {
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
    console.log('No auth token - user may be logged out');
    return false;
  }

  if (!API_BASE) {
    console.warn('No API base URL configured');
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
      const data = await response.json();
      console.log('✓ Location updated:', {
        source: data.source,
        fields: data.updated_fields,
      });
      return true;
    } else if (response.status === 401) {
      console.log('User not authenticated');
      return false;
    } else {
      console.warn('Failed to update location:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error sending location to backend:', error);
    return false;
  }
}

/**
 * Hook for tracking user location in browser
 * Attempts GPS first, falls back to IP geolocation on backend
 */
export function useLocationTracking() {
  const locationUpdateAttempted = useRef(false);

  useEffect(() => {
    // Only try once per page load
    if (locationUpdateAttempted.current) {
      return;
    }
    locationUpdateAttempted.current = true;

    const trackLocation = async () => {
      // Only track if user is logged in
      const token = getAuthToken();
      if (!token) {
        console.log('User not logged in, skipping location tracking');
        return;
      }

      // Check if Geolocation API is available
      if (!navigator.geolocation) {
        console.log('Geolocation API not available');
        // Still send to backend for IP-based fallback
        await sendLocationToBackend({}, token);
        return;
      }

      let locationData: LocationData = {};

      // Try to get GPS location
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        });

        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || undefined,
        };

        console.log('✓ GPS location obtained');
      } catch (error) {
        // GPS was denied or timed out - that's fine, we'll use IP fallback
        const geoError = error as GeolocationPositionError;
        if (geoError.code === 1) {
          console.log('User denied GPS permission');
        } else {
          console.log('GPS unavailable, using IP geolocation');
        }
      }

      // Send to backend (GPS data if available, otherwise backend will use IP)
      await sendLocationToBackend(locationData, token);
    };

    // Start tracking after a delay to ensure page is loaded
    const timeout = setTimeout(trackLocation, 1000);

    return () => clearTimeout(timeout);
  }, []);
}

export default useLocationTracking;
