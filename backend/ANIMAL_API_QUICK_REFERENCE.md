# Animal Marketplace API - Quick Reference Guide

## API Endpoints Overview

### Animal Categories
```
GET    /api/animals/categories/           List all animal categories
GET    /api/animals/categories/{id}/      Get category details
GET    /api/animals/categories/legality/  Check legal status by state
```

**Example - Check Legality:**
```bash
curl "http://localhost:8000/api/animals/categories/legality/?state=CA"
```

---

### Seller Verification (KYC)
```
POST   /api/animals/verification/         Submit KYC application
GET    /api/animals/verification/         Get my verification
GET    /api/animals/verification/{id}/    Get verification details
GET    /api/animals/verification/status/  Check my verification status
PATCH  /api/animals/verification/{id}/    Update verification
```

**Seller Verification Status Values:**
- `pending` - Awaiting admin review
- `verified` - Approved and active
- `rejected` - Not approved
- `expired` - Needs renewal

---

### Animal Listings (Main Feature)
```
GET    /api/animals/listings/             List all active listings
POST   /api/animals/listings/             Create new listing
GET    /api/animals/listings/{id}/        Get listing details
PUT    /api/animals/listings/{id}/        Update listing
PATCH  /api/animals/listings/{id}/        Partial update
DELETE /api/animals/listings/{id}/        Delete listing

GET    /api/animals/listings/my_listings/ Get my listings only
POST   /api/animals/listings/{id}/increment_view/      Track a view
POST   /api/animals/listings/{id}/report_suspicious/   Report fraud
GET    /api/animals/listings/{id}/seller_profile/     Get seller info
```

**Listing Status Values:**
- `active` - Currently available
- `sold` - Item sold
- `expired` - Listing has expired
- `removed` - Removed by seller or admin

**Listing Legal Status:**
- `compliant` - Legal in listing state
- `non_compliant` - Illegal in listing state
- `uncertain` - Requires manual review

**Example - Create Listing:**
```json
POST /api/animals/listings/
{
  "name": "Golden Retriever Puppy",
  "description": "8-week-old female pup",
  "category": 1,
  "breed": "Golden Retriever",
  "age": "8 weeks",
  "gender": "F",
  "price": 800.00,
  "city": "San Francisco",
  "state": "CA",
  "zip_code": "94105",
  "seller_verified": true,
  "vet_documentation": 1,
  "allows_shipping": true
}
```

---

### Animal Listing Media
```
POST   /api/animals/media/                Upload media for listing
GET    /api/animals/media/                List all media
GET    /api/animals/media/{id}/           Get media details
DELETE /api/animals/media/{id}/           Delete media
```

**Supported Media Types:**
- `photo` - JPEG, PNG, WebP
- `video` - MP4, WebM

**Stock Photo Detection:**
- Automatically detected when uploading
- Listings with only stock photos are flagged
- Risk score increases if no real photos provided

---

### Seller Reviews
```
POST   /api/animals/reviews/              Create review for seller
GET    /api/animals/reviews/              List reviews
GET    /api/animals/reviews/{id}/         Get review details
```

**Rating Scale:**
- 1 - Poor
- 2 - Fair
- 3 - Good
- 4 - Very Good
- 5 - Excellent

**Rules:**
- Only buyers can review sellers
- One review per transaction
- Reviews visible on seller profile

---

### Breeder Directory
```
GET    /api/animals/breeders/             List premium breeders
POST   /api/animals/breeders/             Apply to directory
GET    /api/animals/breeders/{id}/        Get breeder profile
GET    /api/animals/breeders/search/      Search premium breeders
POST   /api/animals/breeders/{id}/upgrade_subscription/  Upgrade tier
```

**Subscription Tiers:**
- `basic` - Standard listing
- `premium` - Featured in search
- `platinum` - Enhanced profile, priority support

---

## Risk Scoring System

Each listing gets a risk score (0-100) based on:

| Risk Factor | Score |
|-------------|-------|
| Unusually low price | +25 |
| Unusually high price | +15 |
| Multiple rapid edits | +20 |
| Vague description | +15 |
| No vet documentation | +30 |
| Unverified seller | +40 |
| Seller new account | +20 |
| Multiple complaints | +50 |
| Reported as scam | +100 |

**Risk Levels:**
- **LOW** (0): Safe listing
- **MEDIUM** (30): Some concerns, verify seller
- **HIGH** (60): Multiple flags, buyer caution advised
- **CRITICAL** (85+): Likely fraudulent, flagged for review

---

## Seller Verification Requirements

Sellers must provide:
1. ✅ Valid government ID (photo upload)
2. ✅ Full name and contact information
3. ✅ Address verification
4. ✅ Phone number
5. ✅ Date of birth
6. ⚙️ Seller type (individual/breeder/shelter/rescue)

**Verification Expiry:** 365 days (renewable)

---

## State Restrictions

Animal legality varies by state. Each category can define:
- `prohibited` - Completely banned
- `allowed` - Legal for anyone
- `restricted` - Requires license/certification
- `requires_documentation` - Must show permits
- `breed_restricted` - Only specific breeds allowed

**Example State Restriction:**
```json
{
  "state_restrictions": {
    "CA": {
      "legal": true,
      "requirements": ["Must be 8+ weeks old"],
      "prohibited_breeds": []
    },
    "NY": {
      "legal": false,
      "requirements": [],
      "prohibited_breeds": ["All exotic animals"]
    }
  }
}
```

---

## Common Operations

### List Active Listings with Filters
```bash
# By category
curl "http://localhost:8000/api/animals/listings/?category=1"

# By location
curl "http://localhost:8000/api/animals/listings/?state=CA&city=San+Francisco"

# By price range
curl "http://localhost:8000/api/animals/listings/?price_min=100&price_max=1000"

# By seller
curl "http://localhost:8000/api/animals/listings/?seller=5"

# Sort by newest
curl "http://localhost:8000/api/animals/listings/?ordering=-created_at"
```

### Get Top Rated Breeders
```bash
curl "http://localhost:8000/api/animals/breeders/?ordering=-average_rating"
```

### Get Seller's Average Rating
```bash
curl "http://localhost:8000/api/animals/listings/{id}/seller_profile/"
```

Response includes:
- Seller information
- Total reviews count
- Average rating (1-5 stars)
- Recent reviews list

### Report Suspicious Activity
```bash
curl -X POST "http://localhost:8000/api/animals/listings/{id}/report_suspicious/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "suspected_fraud",
    "description": "Listing appears to use fake photos"
  }'
```

---

## Authentication

All POST/PUT/PATCH/DELETE requests require:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" ...
```

Get token by logging in:
```bash
POST /api/token/
{
  "email": "user@example.com",
  "password": "password"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no token) |
| 403 | Forbidden (permission denied) |
| 404 | Not found |
| 500 | Server error |

**Example Error Response:**
```json
{
  "detail": "Permission denied",
  "error_code": "permission_denied"
}
```

---

## Configuration Reference

Current values in `settings.py`:

| Setting | Value | Env Variable |
|---------|-------|--------------|
| Verification Expiry | 365 days | `ANIMAL_VERIFICATION_EXPIRY_DAYS` |
| Listing Expiry | 90 days | `ANIMAL_LISTING_EXPIRY_DAYS` |
| Max Photos | 12 | `ANIMAL_MAX_PHOTOS` |
| Auto-Approve Sellers | false | `ANIMAL_AUTO_APPROVE` |

---

## Troubleshooting

**Verification Stuck in Pending**
- Admin hasn't reviewed yet
- Check /admin/main/sellerverification/
- Click approve or reject

**Listing Not Appearing**
- Seller not verified
- Legal status is non_compliant for that state
- Risk score is critical (blocked)
- Status is not "active"

**Can't Create Review**
- You must be the buyer
- You need to have a transaction history
- Can only review once per listing

**Permission Denied Errors**
- Ensure you're authenticated (Bearer token)
- Verify token is not expired
- Check if you have required permissions

---

## Next Steps

1. Run migrations: `python manage.py migrate`
2. Create superuser: `python manage.py createsuperuser`
3. Access admin: `http://localhost:8000/admin/`
4. Add animal categories
5. Test endpoints with provided examples
6. Integrate with frontend components

---

**Last Updated**: 2024
**Status**: Production Ready ✅
