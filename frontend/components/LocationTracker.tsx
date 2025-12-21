'use client';

import { useLocationTracking } from '@/hooks/useLocationTracking';

/**
 * LocationTracker Component
 * Initializes location tracking when user is logged in.
 * Attempts to get GPS location, falls back to IP geolocation.
 */
export function LocationTracker() {
  useLocationTracking();
  return null; // Invisible component
}

export default LocationTracker;
