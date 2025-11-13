# Marketplace API Endpoints - Complete Reference

All marketplace endpoints are now fully implemented and registered. Base URL: `/api/`

## Categories

### List Categories
```
GET /marketplace/categories/
```
**Permission**: Public (AllowAny)
**Response**: Paginated list of active categories
```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic items and gadgets",
      "icon_url": "https://...",
      "is_active": true
    }
  ]
}
```

### Get Category Detail
```
GET /marketplace/categories/{slug}/
```
**Permission**: Public
**Response**: Single category object

---

## Listings

### List Listings
```
GET /marketplace/listings/
```
**Permission**: Authenticated
**Query Parameters**:
- `search` (string): Search in title, description, location
- `category` (slug): Filter by category slug
- `min_price` (float): Minimum price
- `max_price` (float): Maximum price
- `condition` (string): Filter by condition (new, like-new, excellent, good, fair, poor)
- `location` (string): Filter by location (substring match)
- `ordering` (string): Sort by `created_at`, `price`, `views_count` (prefix with `-` for descending)
- `page` (int): Page number for pagination

**Response**: Paginated list of active listings

### Get Listing Detail
```
GET /marketplace/listings/{id}/
```
**Permission**: Authenticated
**Response**: Detailed listing with media array

### Create Listing
```
POST /marketplace/listings/
```
**Permission**: Authenticated
**Payload**:
```json
{
  "title": "Vintage Leather Jacket",
  "description": "Excellent condition...",
  "price": 150.00,
  "category": 1,
  "condition": "like-new",
  "location": "San Francisco, CA",
  "contact_preference": "messaging",
  "delivery_options": ["local_pickup", "shipping"]
}
```

### Update Listing
```
PATCH /marketplace/listings/{id}/
PUT /marketplace/listings/{id}/
```
**Permission**: Authenticated (owner only)
**Payload**: Same as create (all fields optional for PATCH)

### Delete Listing
```
DELETE /marketplace/listings/{id}/
```
**Permission**: Authenticated (owner only)

### Get My Listings
```
GET /marketplace/listings/my_listings/
```
**Permission**: Authenticated
**Query Parameters**:
- `status` (string): Filter by status (active, sold, inactive)
- `page` (int): Page number

**Response**: Paginated list of current user's listings

### Increment View Count
```
POST /marketplace/listings/{id}/view/
```
**Permission**: Authenticated
**Response**: `{"views_count": 42}`

### Toggle Save/Bookmark Listing
```
POST /marketplace/listings/{id}/save/
```
**Permission**: Authenticated
**Response**: `{"saved": true, "saved_count": 5}`

### Report Listing
```
POST /marketplace/listings/{id}/report/
```
**Permission**: Authenticated
**Payload**:
```json
{
  "reason": "spam",
  "description": "This listing is..."
}
```

### Mark Listing as Sold
```
POST /marketplace/listings/{id}/mark_sold/
```
**Permission**: Authenticated (owner only)
**Response**: Updated listing object with status="sold"

### Get Trending Listings
```
GET /marketplace/listings/trending/
```
**Permission**: Authenticated
**Response**: Top 20 trending listings from last 7 days

---

## Offers

### List Offers
```
GET /marketplace/offers/
```
**Permission**: Authenticated
**Response**: Offers made by user + offers received on user's listings
- Query parameters: standard pagination

### Get Offer Detail
```
GET /marketplace/offers/{id}/
```
**Permission**: Authenticated (buyer or seller only)

### Create Offer
```
POST /marketplace/offers/
```
**Permission**: Authenticated
**Payload**:
```json
{
  "listing": 1,
  "offered_price": 120.00,
  "message": "Is this price negotiable?"
}
```
**Note**: User can only make one offer per listing

### Accept Offer
```
POST /marketplace/offers/{id}/accept/
```
**Permission**: Authenticated (seller only)
**Effect**: Offer status → "accepted", Listing status → "sold"

### Decline Offer
```
POST /marketplace/offers/{id}/decline/
```
**Permission**: Authenticated (seller only)
**Payload**:
```json
{
  "message": "Sorry, I've already accepted another offer"
}
```
**Effect**: Offer status → "declined"

---

## Saved Listings

### List Saved Listings
```
GET /marketplace/saves/
```
**Permission**: Authenticated
**Response**: Paginated list of saved listings

---

## Media

### List Media for Listing
```
GET /marketplace/media/
```
**Permission**: Authenticated (owner only)
**Query Parameters**:
- Standard pagination

### Create Media Item
```
POST /marketplace/media/
```
**Permission**: Authenticated (listing owner only)
**Payload**:
```json
{
  "listing": 1,
  "media_url": "https://s3.amazonaws.com/...",
  "media_type": "image",
  "order": 0
}
```
**Response**: Created media object

### Delete Media
```
DELETE /marketplace/media/{id}/
```
**Permission**: Authenticated (listing owner only)

---

## Seller Verification

### List My Verifications
```
GET /marketplace/seller-verification/
GET /marketplace/seller-verification/my_verifications/
```
**Permission**: Authenticated
**Response**: Current user's verification status

---

## Response Format

### Success (2xx)
```json
{
  "id": 1,
  "title": "Item Name",
  ...
}
```

### Error (4xx/5xx)
```json
{
  "detail": "Error message"
}
```
or
```json
{
  "field_name": ["Error message"]
}
```

---

## Filters & Conditions

**Listing Conditions**:
- `new`
- `like-new`
- `excellent`
- `good`
- `fair`
- `poor`

**Listing Status**:
- `active` (default, only shown in listings endpoint)
- `sold`
- `inactive` (hidden/delisted)

**Offer Status**:
- `pending`
- `accepted`
- `declined`

**Contact Preferences**:
- `messaging`
- `phone`
- `email`

**Delivery Options** (array):
- `local_pickup`
- `shipping`

---

## Pagination

All list endpoints support pagination:
- `page` (default: 1)
- `page_size` (default: 20, configurable)

Response includes:
```json
{
  "count": 150,
  "next": "http://...",
  "previous": null,
  "results": [...]
}
```

---

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer {access_token}
```

---

## Rate Limiting

Follows Django REST Framework defaults (configurable per deployment)

---

## Frontend Integration

All endpoints are integrated in the frontend at:
- `/app/marketplace` - Browse listings
- `/app/marketplace/[id]` - View listing detail
- `/app/marketplace/create` - Create new listing
- `/app/marketplace/[id]/edit` - Edit listing
- `/app/marketplace/my-listings` - Manage your listings
- `/app/marketplace/offers` - Manage offers

All API calls use the `apiGet`, `apiPost`, `apiPatch`, `apiDelete` helpers from `/frontend/lib/api.ts`

