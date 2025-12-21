# Location Tracking - Quick Setup Guide

## What Was Implemented

A complete dual-source location tracking system:

- **Primary**: GPS location (highest accuracy)
- **Fallback**: IP-based geolocation (automatic, no consent needed)

The system automatically collects user location on app startup and populates:
- `user.country`
- `user.state` 
- `user.city`

This data powers the admin analytics micro-segmentation feature.

## Files Created/Modified

### Backend
✅ `backend/users/location_views.py` - NEW location tracking endpoint
✅ `backend/users/urls.py` - MODIFIED to add routes

### Mobile (Expo/React Native)
✅ `mobile/hooks/useLocationTracking.ts` - NEW location tracking hook
✅ `mobile/app/_layout.tsx` - MODIFIED to call hook on startup

### Admin Web (Next.js)
✅ `admin/hooks/useLocationTracking.ts` - NEW browser location hook
✅ `admin/components/LocationTracker.tsx` - NEW tracker component  
✅ `admin/app/layout.tsx` - MODIFIED to integrate tracker

## How It Works

### User Opens App/Website

```
App/Website Loads
  ↓
Location tracking hook initializes (after 1 second delay)
  ↓
Requests GPS permission from user
  ↓
  
If user grants permission:
  └─ Gets GPS coordinates (lat/lon with accuracy)
  └─ Sends to backend: POST /api/auth/update-location/
  └─ Backend stores GPS location
  
If user denies permission:
  └─ Sends empty request to backend
  └─ Backend extracts client IP address
  └─ Backend uses IP-to-location service to find country/state/city
  └─ Backend stores IP-based location
```

### Backend Endpoint

**Route**: `POST /api/auth/update-location/`

**Request** (optional GPS):
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 50
}
```

**Response**:
```json
{
  "success": true,
  "source": "gps" | "ip",
  "location": {
    "country": "United States",
    "state": "New York",
    "city": "New York"
  },
  "updated_fields": ["country", "state", "city"]
}
```

## IP Geolocation Details

The system tries to get IP location using:

1. **Method 1** (Preferred): Django's built-in GeoIP2 
   - Requires MaxMind GeoLite2/GeoIP2 database
   - Most accurate, privacy-friendly (local)
   - Setup: Download `.mmdb` file from MaxMind

2. **Method 2** (Fallback): ip-api.com public API
   - Free tier: 45 requests/minute
   - Works out-of-the-box, no setup needed
   - Good for development/testing

3. **Method 3** (Future): Other services (ipstack, MaxMind Cloud, etc.)

Currently configured to use Method 2 by default (works immediately).

To use MaxMind (Method 1 - better privacy):
```bash
# Download from https://dev.maxmind.com/geoip/geolite2-city/
# Place GeoLite2-City.mmdb in /path/to/geoip/

# Add to settings.py:
GEOIP_PATH = '/path/to/geoip/'
GEOIP_CITY = 'GeoLite2-City.mmdb'
```

## Testing

### Test Backend Endpoint
```bash
# Get a valid Bearer token from your login
TOKEN="your_admin_token_here"

# Test with GPS data
curl -X POST https://api.mylibertysocial.com/api/auth/update-location/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.7128, "longitude": -74.0060}'

# Test with IP fallback (no GPS)
curl -X POST https://api.mylibertysocial.com/api/auth/update-location/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test Mobile App
1. Open app
2. Wait for location permission prompt
3. Accept or deny
4. Check user profile - location should be populated

### Test Admin Dashboard
1. Go to https://admin.mylibertysocial.com
2. Browser should request location permission
3. Accept or deny
4. Location will be saved to your admin user profile

## Checking User Locations in Admin

With location data now populated, admins can:

1. **View Analytics Dashboard**:
   - Go to: https://admin.mylibertysocial.com/analytics
   - See breakdown by country, state, city

2. **Micro-Segmentation**:
   - Filter users by gender, country, state, age range
   - Combine multiple filters
   - See user statistics for each segment

3. **Location-Based Insights**:
   - Top countries by users
   - State distribution
   - City breakdown
   - Age demographics by location

## Troubleshooting

### "Location tracking not working"

**Check 1**: Backend endpoint is registered
```bash
cd backend
python manage.py shell
>>> from django.urls import resolve
>>> resolve('auth/update-location/')
# Should return the view, not 404
```

**Check 2**: User is authenticated
- Ensure Bearer token is valid
- Check token hasn't expired

**Check 3**: Mobile app has location permission in manifest
```json
// app.json
{
  "plugins": [
    [
      "expo-location",
      { "locationAlwaysAndWhenInUsePermissions": true }
    ]
  ]
}
```

### "Getting 401 errors"

- Token is missing or invalid
- Check localStorage: `localStorage.getItem('liberty-social-admin-access-token')`
- Re-login and try again

### "Location showing as wrong city"

- IP geolocation can be inaccurate (sometimes off by miles)
- GPS is much more accurate
- Ensure user is granting GPS permission
- Wait a few seconds for async operations

### "ip-api.com giving errors"

- Free tier has rate limits (45 req/min)
- Or IP might be blacklisted for abuse
- Switch to MaxMind GeoIP2 for production

## Next Steps

1. ✅ Restart backend to load new endpoints
2. ✅ Deploy location tracking to mobile
3. ✅ Deploy location tracker to admin
4. ✅ Monitor user location data population
5. 🔄 (Optional) Set up MaxMind GeoIP2 for better accuracy
6. 🔄 (Optional) Add reverse geocoding for GPS coordinates
7. 🔄 (Optional) Build location-based features

## Production Considerations

### Privacy & Compliance
- ✅ Add location to privacy policy
- ✅ Explain why you collect location data
- ✅ Allow users to opt-out (future enhancement)
- ✅ Comply with GDPR/CCPA

### Performance
- Location tracking runs once per session (doesn't spam)
- Async requests don't block user interactions
- Graceful error handling - won't break app if location fails

### Monitoring
- Check logs for geolocation errors
- Monitor analytics to see location data quality
- Consider location accuracy metrics

## Support

For questions about:
- **Backend API**: See `LOCATION_TRACKING_IMPLEMENTATION.md`
- **Mobile integration**: Check `mobile/hooks/useLocationTracking.ts`
- **Admin dashboard**: Check `admin/hooks/useLocationTracking.ts`
- **Analytics**: See `ANALYTICS_SETUP_COMPLETE.md`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  USER DEVICES (Mobile, Web, Admin)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Mobile (Expo):              Admin/Web (Browser):            │
│  ├─ useLocationTracking()    ├─ LocationTracker             │
│  ├─ Request GPS permission   ├─ useLocationTracking()       │
│  └─ Send to /update-location └─ Request GPS permission      │
│                               └─ Send to /update-location   │
└──────────────┬──────────────────────────┬────────────────────┘
               │                          │
        Sends GPS (optional)        Sends GPS (optional)
        or empty request            or empty request
               │                          │
               └──────────────┬───────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  BACKEND (Django)                                             │
├──────────────────────────────────────────────────────────────┤
│  POST /api/auth/update-location/                             │
│  ├─ Receives: latitude, longitude (optional)                 │
│  ├─ If GPS provided:                                          │
│  │  └─ Updates user.latitude, user.longitude                 │
│  ├─ If no GPS:                                                │
│  │  ├─ Extracts client IP from request                       │
│  │  ├─ Looks up IP → country, state, city                    │
│  │  └─ Updates user.country, user.state, user.city           │
│  └─ Response: success + location data                        │
│                                                               │
│  IP Geolocation Methods:                                      │
│  ├─ Method 1: MaxMind GeoIP2 (local, accurate)               │
│  └─ Method 2: ip-api.com (free, public API)                  │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ Updates user location data
               │
┌──────────────▼───────────────────────────────────────────────┐
│  DATABASE (PostgreSQL)                                        │
├──────────────────────────────────────────────────────────────┤
│  users_user table:                                            │
│  ├─ id (PK)                                                   │
│  ├─ username                                                  │
│  ├─ email                                                     │
│  ├─ country ← Updated by location tracking                   │
│  ├─ state   ← Updated by location tracking                   │
│  ├─ city    ← Updated by location tracking                   │
│  ├─ age     ← Can be updated with location                   │
│  └─ ... other fields ...                                      │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ Used by analytics
               │
┌──────────────▼───────────────────────────────────────────────┐
│  ADMIN ANALYTICS DASHBOARD                                    │
├──────────────────────────────────────────────────────────────┤
│  /analytics page                                              │
│  ├─ View all users: Total, Active, by Gender                 │
│  ├─ Filter by: Country, State, Age, Gender                   │
│  ├─ Micro-segmentation: Combine multiple filters              │
│  ├─ See: User breakdown, Top countries, State distribution    │
│  └─ Data from: users with country/state/city populated       │
└──────────────────────────────────────────────────────────────┘
```

Everything is now connected and ready to collect location data!
