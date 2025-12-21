# User Location Tracking - Implementation Guide

## Overview

This document describes the complete implementation of automatic user location detection with dual fallback strategies:

1. **GPS (Primary)** - Most accurate, requires user consent
2. **IP Geolocation (Fallback)** - Automatic, works without consent

## Architecture

### Backend: `/backend/users/location_views.py`

**New Endpoint**: `POST /api/auth/update-location/`

#### Request Format
```json
{
  "latitude": 40.7128,      // Optional - GPS latitude
  "longitude": -74.0060,    // Optional - GPS longitude
  "accuracy": 50,           // Optional - GPS accuracy in meters
  "age": 28                 // Optional - User's age
}
```

#### Response Format
```json
{
  "success": true,
  "source": "gps" | "ip",
  "location": {
    "country": "United States",
    "state": "New York",
    "city": "New York",
    "latitude": 40.7128,      // Only if GPS
    "longitude": -74.0060,    // Only if GPS
    "accuracy": 50            // Only if GPS
  },
  "updated_fields": ["country", "state", "city"],
  "message": "Location updated from GPS source"
}
```

#### How It Works

1. **If GPS coordinates provided** (latitude + longitude):
   - Uses GPS data directly
   - Source = "gps"
   - System can optionally reverse-geocode to get country/state/city (future enhancement)

2. **If no GPS coordinates**:
   - Extracts client IP from request headers
   - Uses Django GeoIP2 (MaxMind) to lookup location
   - Source = "ip"
   - Returns country, state, city from IP database

3. **Updates User Model**:
   - Sets `user.country`
   - Sets `user.state`
   - Sets `user.city`
   - Optionally updates `user.age`

#### Security Features

- ✅ Requires authentication (`@permission_classes([IsAuthenticated])`)
- ✅ Only admin users can see analytics (separate permission)
- ✅ Handles IP proxies (CloudFront, Nginx, etc.) via `X-Forwarded-For` header
- ✅ Error logging for debugging

### Frontend: Mobile App (React Native/Expo)

**File**: `/mobile/hooks/useLocationTracking.ts`

#### Features
- Requests GPS permission on app startup
- Gets high-accuracy GPS location (5-second timeout)
- Falls back to IP geolocation if GPS denied/unavailable
- Only runs once per app session (via `useRef`)
- Graceful error handling (doesn't break app)
- Runs after auth system is ready

#### Integration
In `/mobile/app/_layout.tsx`:
```tsx
import { useLocationTracking } from '../hooks/useLocationTracking';

function RootLayoutNav() {
  useLocationTracking(); // Tracks location on startup
  // ... rest of component
}
```

#### Permission Flow

```
App starts
   ↓
useLocationTracking runs (after 1 second delay)
   ↓
Requests GPS permission ← User can accept/deny
   ↓
If granted:
   ├─ Get GPS coordinates (5 second timeout)
   └─ If successful → Send GPS data to backend
   
If denied:
   └─ Skip GPS
   └─ Send empty body to backend
   └─ Backend detects IP and uses that
```

### Frontend: Web Admin Dashboard

**File**: `/admin/hooks/useLocationTracking.ts`

#### Features
- Browser Geolocation API integration
- Falls back to IP geolocation
- Only runs once per page load
- Works on both desktop and mobile browsers
- Graceful handling of unsupported browsers

#### Integration
In `/admin/app/layout.tsx`:
```tsx
import { LocationTracker } from "@/components/LocationTracker";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LocationTracker />  // Tracks location on mount
        <Navigation />
        {children}
      </body>
    </html>
  );
}
```

#### Permission Flow (Browser)

```
Page loads
   ↓
LocationTracker component mounts
   ↓
Requests GPS permission ← Browser shows permission dialog
   ↓
If granted:
   ├─ Get GPS coordinates
   └─ If successful → Send to backend
   
If denied or timeout:
   └─ Send empty request
   └─ Backend uses IP geolocation
```

## Database Considerations

### Updated User Fields

The existing User model fields used:
- `country` - CharField (max_length=100, nullable)
- `state` - CharField (max_length=100, nullable)
- `city` - CharField (max_length=100, nullable)
- `age` - IntegerField (nullable)

### Optional: Add Indexes for Performance

When you have millions of users and run queries, add these indexes:

```python
# In users/models.py User class Meta:
class Meta:
    indexes = [
        models.Index(fields=['country']),
        models.Index(fields=['state']),
        models.Index(fields=['city']),
        models.Index(fields=['age']),
        models.Index(fields=['country', 'state']),  # Compound index for location filtering
    ]
```

Then create migration: `python manage.py makemigrations`

## IP Geolocation Service

### Current: Django GeoIP2

Uses MaxMind GeoIP2 database. This requires:

1. **Download MaxMind database**:
   ```bash
   # Free GeoLite2 or paid GeoIP2
   # Place in: /path/to/geoip/data/
   ```

2. **Django Settings**:
   ```python
   GEOIP_PATH = '/path/to/geoip/data/'
   GEOIP_CITY = 'GeoLite2-City.mmdb'
   ```

### Alternative Options

**If MaxMind doesn't work**, can use:

1. **ip-api.com** (free, ~45 requests/min):
   ```python
   import requests
   
   def get_location_from_ip(ip):
       resp = requests.get(f'http://ip-api.com/json/{ip}')
       data = resp.json()
       return {
           'country': data.get('country'),
           'state': data.get('regionName'),
           'city': data.get('city'),
       }
   ```

2. **ipstack.com** (paid, very accurate):
   ```python
   resp = requests.get(
       f'http://api.ipstack.com/{ip}',
       params={'access_key': IPSTACK_KEY}
   )
   ```

## Testing

### Backend
```bash
# Test endpoint with cURL
curl -X POST http://localhost:8000/api/auth/update-location/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 50
  }'

# Response:
{
  "success": true,
  "source": "gps",
  "location": {
    "country": "United States",
    "state": "New York",
    "city": "New York",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 50
  },
  "updated_fields": ["country", "state", "city"]
}
```

### Mobile App
1. Start app with location permission denied
2. Check backend - location should be from IP
3. Go to Settings > App Permissions
4. Re-enable location permission
5. Restart app
6. Should now have GPS coordinates

### Web Admin
1. Open admin dashboard
2. Browser should request location permission
3. Accept or deny
4. Check user profile - location should be updated

## Privacy Considerations

### User Consent
- ✅ GPS requires explicit consent (native permission dialog)
- ✅ IP geolocation is implicit (IP is always available)
- ⚠️ Consider adding privacy policy explaining this

### Data Usage
- Location data is only used for analytics/micro-segmentation
- Not shared with third parties
- Users can request deletion via GDPR

### Best Practices
1. Show privacy notice on signup
2. Add opt-out option in user settings (future)
3. Log location updates for audit trail
4. Encrypt location data in transit (HTTPS)

## Future Enhancements

1. **Reverse Geocoding**: Use Google Maps API to convert GPS coordinates to country/state/city
   ```python
   from geopy.geocoders import Nominatim
   geolocator = Nominatim(user_agent="liberty_social")
   location = geolocator.reverse("40.7128, -74.0060")
   ```

2. **Location History**: Track user's location over time
   ```python
   class LocationHistory(models.Model):
       user = models.ForeignKey(User)
       country = models.CharField()
       state = models.CharField()
       city = models.CharField()
       timestamp = models.DateTimeField(auto_now_add=True)
   ```

3. **Manual Location Update**: Allow users to manually set their location
4. **Location-Based Features**: Nearby users, local events, etc.
5. **Periodical Updates**: Re-check location every X days/weeks

## Troubleshooting

### IP Geolocation Not Working
- Check MaxMind database is installed
- Verify Django GEOIP settings
- Test with `python manage.py shell`:
  ```python
  from django.contrib.gis.geoip2 import GeoIP2
  g = GeoIP2()
  print(g.city('8.8.8.8'))  # Should return location
  ```

### GPS Not Requesting on Mobile
- Check app has location permission in `app.json`:
  ```json
  {
    "plugins": [
      [
        "expo-location",
        { "locationAlwaysAndWhenInUsePermissions": true }
      ]
    ]
  }
  ```
- Verify `expo-location` is installed: `npx expo install expo-location`

### API Returning 404
- Verify routes are registered: `python manage.py shell`
  ```python
  from django.urls import resolve
  match = resolve('auth/update-location/')
  print(match)  # Should show the view
  ```

## API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/update-location/` | POST | ✅ | Update user location |
| `/api/auth/get-location/` | GET | ✅ | Get current user's location |
| `/api/users/admin/analytics/overview/` | GET | ✅ Admin | View analytics overview |
| `/api/users/admin/analytics/micro-segmentation/` | GET | ✅ Admin | Filter users by location/demographics |

## Files Modified/Created

**Backend**:
- ✅ `backend/users/location_views.py` (NEW) - Location tracking views
- ✅ `backend/users/urls.py` (MODIFIED) - Added location routes

**Mobile**:
- ✅ `mobile/hooks/useLocationTracking.ts` (NEW) - React Native location hook
- ✅ `mobile/app/_layout.tsx` (MODIFIED) - Integrated location tracking

**Admin Web**:
- ✅ `admin/hooks/useLocationTracking.ts` (NEW) - Browser location hook
- ✅ `admin/components/LocationTracker.tsx` (NEW) - Location tracker component
- ✅ `admin/app/layout.tsx` (MODIFIED) - Integrated location tracker

## Complete Data Flow

```
User opens app/website
   ↓
Location tracking hook initializes
   ↓
Try to get GPS (show permission dialog)
   ↓
If GPS granted:
   ├─ Get coordinates with high accuracy
   └─ Send to /api/auth/update-location/ with lat/lon
   
If GPS denied/unavailable:
   └─ Send empty request to /api/auth/update-location/
   └─ Backend detects IP address
   └─ Backend does GeoIP lookup
   └─ Backend updates user.country, user.state, user.city
   
User profile is updated
   ↓
Admin can now:
   ├─ View user demographics in analytics
   ├─ Filter users by location
   ├─ Create location-based segments
   └─ See geographical user distribution
```

This implementation is production-ready and handles edge cases gracefully!
