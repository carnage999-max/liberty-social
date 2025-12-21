# Admin Analytics Feature - Implementation Summary

## Overview
Added comprehensive user analytics and demographic segmentation to the admin dashboard, allowing admins to mix and match multiple data points (gender, age, location, activity status) for detailed user micro-segmentation.

---

## Backend Changes

### 1. Database Model Updates
**File**: `backend/users/models.py`

Added new fields to the User model:
```python
age = models.IntegerField(_("Age"), null=True, blank=True)
country = models.CharField(_("Country"), max_length=100, null=True, blank=True)
state = models.CharField(_("State/Province"), max_length=100, null=True, blank=True)
city = models.CharField(_("City"), max_length=100, null=True, blank=True)
```

**Migration**: `users/migrations/0016_add_demographic_fields.py`
- Adds age, country, state, and city fields to track user location and demographics

### 2. Analytics API Endpoints
**File**: `backend/users/analytics_views.py` (NEW)

Created 7 new API endpoints for admin analytics:

#### GET `/api/users/admin/analytics/overview/`
Returns overall metrics (total users, active users, gender stats, age stats)

#### GET `/api/users/admin/analytics/by-country/`
Returns user counts by country with gender and activity breakdown

#### GET `/api/users/admin/analytics/by-state/`
Returns user counts by state (optionally filtered by country)

Query params: `?country=United States`

#### GET `/api/users/admin/analytics/by-age/`
Returns user counts by age group with optional gender/country filters

Query params: `?gender=female&country=United States`

#### GET `/api/users/admin/analytics/by-gender/`
Returns gender breakdown with optional country and age range filters

Query params: `?country=Canada&age_min=18&age_max=35`

#### GET `/api/users/admin/analytics/micro-segmentation/`
**Most powerful endpoint** - Filter users by any combination of:
- `gender`: 'male', 'female', or omit for all
- `country`: country name
- `state`: state/province name
- `age_min`: minimum age
- `age_max`: maximum age
- `active_only`: 'true' for active users only

Example: `/api/users/admin/analytics/micro-segmentation/?gender=female&country=United States&age_min=25&age_max=35`

Returns:
```json
{
  "filters": { ...applied filters },
  "summary": {
    "total": 1250,
    "male": 400,
    "female": 850,
    "active": 320,
    "average_age": 28.5
  },
  "breakdown": {
    "by_gender": [...],
    "by_age": [...]
  }
}
```

#### GET `/api/users/admin/analytics/top-countries/`
Returns top countries by user count

Query params: `?limit=20` (default: 10)

### 3. URL Routing
**File**: `backend/users/urls.py`

Added all analytics endpoints to the admin routes under `/api/users/admin/analytics/*`

---

## Frontend Changes

### 1. Analytics Filter Component
**File**: `admin/components/AnalyticsFilter.tsx` (NEW)

React component for filtering analytics data with controls for:
- Gender dropdown (All, Male, Female)
- Country dropdown (dynamic list from API)
- Age range inputs (Min/Max)
- Active users toggle checkbox

Props:
```typescript
interface AnalyticsFilterProps {
  onFilterChange: (filters: AnalyticsFilters) => void;
  countries: string[];
}
```

### 2. Analytics Dashboard Page
**File**: `admin/app/analytics/page.tsx` (NEW)

Full-featured analytics dashboard featuring:
- **Summary Cards**: Total users, active users, male/female counts, average age
- **Gender Breakdown**: Visual bar chart showing gender distribution
- **Top Countries**: List of top 10 countries with gender and activity breakdown
- **Real-time Filtering**: Apply multiple filters simultaneously
- **Data Fetching**: Uses SWR for efficient data loading

Key features:
- Loads list of countries on mount for filter dropdown
- Fetches analytics data when filters change
- Shows loading state during data fetch
- Error handling and display
- Token-based authentication

### 3. Admin Dashboard Navigation
**File**: `admin/app/page.tsx`

Added "Analytics" button to the main admin dashboard header for easy navigation to the analytics page.

---

## Data Model

### User Fields Added
```
age (Integer, nullable)
country (String, nullable)
state (String, nullable)
city (String, nullable)
```

These fields integrate with existing fields:
- `gender` (already existed)
- `is_online` (for active user tracking)
- `last_seen` and `last_activity` (for activity tracking)

---

## Usage Examples

### Example 1: Get all female users in the United States
```
GET /api/users/admin/analytics/micro-segmentation/?gender=female&country=United States
```

### Example 2: Get active males aged 25-40 in California
```
GET /api/users/admin/analytics/micro-segmentation/?gender=male&country=United States&state=California&age_min=25&age_max=40&active_only=true
```

### Example 3: Get top 20 countries by user count
```
GET /api/users/admin/analytics/top-countries/?limit=20
```

### Example 4: Gender breakdown for users in Canada aged 18+
```
GET /api/users/admin/analytics/by-gender/?country=Canada&age_min=18
```

---

## Authentication

All analytics endpoints require:
- Admin authentication (IsAdminUser permission)
- Bearer token in Authorization header

```
Authorization: Bearer <admin_access_token>
```

---

## Next Steps

To fully utilize these features:

1. **Populate User Data**: Update user registration to capture:
   - Age
   - Country (from IP geolocation or user input)
   - State/Province (from user input)
   - City (from IP geolocation or user input)

2. **Mobile App Integration**: Update mobile app to:
   - Request age during onboarding
   - Request location permission for IP-based geo-location
   - Store user location data

3. **Geolocation Library**: Consider adding a library like `geoip2` or using IP geolocation API to auto-detect:
   - Country from IP address
   - State/Province from IP address

4. **Advanced Visualizations**: Future enhancements:
   - Interactive map showing user distribution by state
   - Time-series charts for user growth by country
   - Export analytics data to CSV
   - Custom date range selection

---

## Performance Considerations

- All analytics queries use `filter()` and `annotate()` for efficient database queries
- Counts are calculated at the database level, not in Python
- Results are paginated and limited (e.g., top-countries defaults to 10)
- Consider adding database indexes on:
  - `gender`
  - `country`
  - `state`
  - `age`
  - `is_online`

```python
# Suggested model updates:
class Meta:
    indexes = [
        models.Index(fields=['gender']),
        models.Index(fields=['country']),
        models.Index(fields=['state']),
        models.Index(fields=['age']),
        models.Index(fields=['is_online']),
        models.Index(fields=['country', 'state']),
        models.Index(fields=['gender', 'country']),
    ]
```

---

## Testing Checklist

- [ ] Run migration: `python manage.py migrate`
- [ ] Test each analytics endpoint with different filter combinations
- [ ] Verify admin permission enforcement on all endpoints
- [ ] Test analytics dashboard loads without errors
- [ ] Test filter changes update data in real-time
- [ ] Test with sample data where users have various demographics
- [ ] Check performance with large datasets (1000+ users)

---

## Files Modified/Created

### Backend
- ✅ `backend/users/models.py` - Added demographic fields
- ✅ `backend/users/analytics_views.py` - Created new analytics endpoints
- ✅ `backend/users/urls.py` - Added analytics routes
- ✅ `backend/users/migrations/0016_add_demographic_fields.py` - Auto-generated migration

### Admin Frontend
- ✅ `admin/components/AnalyticsFilter.tsx` - Filter component
- ✅ `admin/app/analytics/page.tsx` - Analytics dashboard page
- ✅ `admin/app/page.tsx` - Added analytics link
