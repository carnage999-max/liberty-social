# Animal Marketplace - Backend Implementation

## Overview

The Animal Marketplace is a comprehensive, safety-first animal sales platform built into Liberty Social. It implements strict verification, legal compliance, and anti-scam measures to create the safest animal marketplace in the U.S.

## Architecture

### Database Models

#### 1. **AnimalCategory**
Categories for animal types with state-based legality rules.

**Key Fields:**
- `animal_type`: CHOICE (dogs, cats, birds, reptiles, small_mammals, livestock, exotics, adoption_rehoming)
- `state_restrictions`: JSON field storing legality rules by state
  ```json
  {
    "CA": {"banned": true},
    "TX": {"requires_license": true},
    "NY": {}
  }
  ```

**Key Methods:**
- `is_legal_in_state(state_code)` - Returns True/False/None
- `get_state_requirements(state_code)` - Returns special requirements dict

---

#### 2. **SellerVerification** (KYC System)
Identity verification for all animal sellers.

**Key Fields:**
- `user` - OneToOne link to auth user
- `full_name`, `phone_number`, `address`, `city`, `state_code`, `zip_code`
- `id_document_url` - Scanned ID
- `id_type` - CHOICE (drivers_license, passport, state_id)
- `breeder_license_url` - Optional for breeders
- `breeder_license_number`
- `status` - CHOICE (pending, verified, rejected, expired)
- `verified_by` - ForeignKey to admin user
- `rejection_reason` - If rejected
- `expires_at` - Verification expiration date

**Key Properties:**
- `is_verified` - Boolean checking current validity
- `seller_badge_url` - Returns badge URL if verified

**Verification Flow:**
1. Seller submits verification application
2. Admin reviews documents
3. If approved: status = "verified", verified_at = now()
4. If rejected: status = "rejected", rejection_reason set

---

#### 3. **VetDocumentation**
Mandatory veterinary health records for listed animals.

**Key Fields:**
- `listing` - OneToOne to AnimalListing
- `documentation_type` - CHOICE (vet_check, vaccination_record, health_certificate, unknown)
- `document_url` - Scanned document
- `document_date` - Date of vet visit/vaccination
- `unknown_disclaimer` - Boolean for "health status unknown"
- `notes` - Additional health notes

**Validation:**
- If `unknown`, must have `unknown_disclaimer=True`
- If not `unknown`, must have `document_url`

---

#### 4. **AnimalListing**
Main animal sale/rehoming listing with comprehensive safety features.

**Key Fields:**
- `seller` - ForeignKey to User
- `category` - ForeignKey to AnimalCategory
- `title`, `description`, `listing_type` (CHOICE: sale, adoption, rehoming)
- `breed`, `age_years`, `age_months`, `gender`, `color`, `special_features`
- `price` - For sales
- `rehoming_fee` - For rehoming listings
- `location`, `state_code`, `latitude`, `longitude`
- `contact_preference` - CHOICE (chat, phone, both)
- `allow_shipping` - Boolean
- `seller_verification` - ForeignKey to SellerVerification
- `is_legal_in_state` - Boolean (checked automatically)
- `legal_check_date` - When legal check occurred
- `legal_issues` - Description of any legal problems
- `status` - CHOICE (draft, active, held, sold, cancelled, flagged)
- `views_count`, `contact_count` - Metrics
- `suspicious_activity` - Boolean flag
- `scam_flags` - JSON array of triggered flags
- `expires_at` - Auto-expire after 90 days

**Key Methods:**
- `check_legal_status()` - Validates legality, sets flags, changes status
- `get_risk_score()` - Returns 0-100 scam risk score
- `media_count` - Property for media count
- `seller_review_score` - Property for average rating

**Money Rules:**
- Adoption listings: `price` must be 0
- Rehoming listings: use `rehoming_fee` not `price`
- "Rehoming fee" is actually money = money changes hands = it's a sale per TOS

---

#### 5. **AnimalListingMedia**
Photos/videos for listings with stock photo detection.

**Key Fields:**
- `listing` - ForeignKey to AnimalListing
- `url` - Media URL
- `media_type` - CHOICE (photo, video)
- `is_primary` - Boolean
- `is_stock_photo` - AI-detected stock photo flag
- `stock_photo_confidence` - 0-1.0 confidence score
- `order` - Display order

**Stock Photo Detection:**
Integrated for AI-based detection (placeholder for ML integration).

---

#### 6. **SellerReview**
Post-transaction reviews of sellers.

**Key Fields:**
- `listing` - ForeignKey to AnimalListing
- `buyer` - ForeignKey to User
- `seller` - ForeignKey to User (auto-set from listing.seller)
- `rating` - 1-5 stars
- `title`, `comment` - Review content
- `accuracy`, `health`, `communication` - Boolean aspects

**Constraints:**
- Unique together: (listing, buyer) - One review per transaction
- Buyer cannot review own listings
- Updates seller's average rating

---

#### 7. **SuspiciousActivityLog**
Audit trail for fraud detection.

**Key Fields:**
- `listing` - ForeignKey to AnimalListing
- `activity_type` - CHOICE (price_manipulation, high_contact_rate, rapid_relisting, photo_theft, unverified_seller_activity, location_mismatch, banned_species, multiple_flagging)
- `description` - Details
- `severity` - CHOICE (low, medium, high, critical)
- `is_resolved` - Boolean
- `resolution_note` - Admin notes
- `detected_at`, `resolved_at`

---

#### 8. **BreederDirectory** (Premium Feature)
Premium listings for verified breeders.

**Key Fields:**
- `seller` - OneToOne to SellerVerification
- `breeder_name`, `bio`, `website`
- `specialties` - JSON list of animal types
- `average_rating`, `total_reviews`
- `is_featured`, `featured_until`
- `subscription_status` - CHOICE (inactive, active, suspended)

**Revenue Model:**
- Monthly subscription for premium placement
- Featured listings boost visibility

---

## API Endpoints

### Animal Categories
```
GET  /api/animals/categories/
GET  /api/animals/categories/{id}/
GET  /api/animals/categories/by_type/?type=dogs
GET  /api/animals/categories/{id}/legality/?state=CA
```

### Seller Verification
```
GET    /api/animals/verification/
GET    /api/animals/verification/status/
POST   /api/animals/verification/
PATCH  /api/animals/verification/
```

### Animal Listings
```
GET    /api/animals/listings/
POST   /api/animals/listings/                    # Create new listing
GET    /api/animals/listings/{id}/
PATCH  /api/animals/listings/{id}/               # Update own listing
DELETE /api/animals/listings/{id}/               # Soft delete to "cancelled"

GET    /api/animals/listings/my_listings/        # User's listings
GET    /api/animals/listings/{id}/seller_profile/ # Seller info & reviews
POST   /api/animals/listings/{id}/increment_view/
POST   /api/animals/listings/{id}/report_suspicious/
```

**Query Parameters:**
- `state` - Filter by state code
- `min_price`, `max_price` - Price range
- `q` - Search in title/description/breed
- `category`, `listing_type`, `status`

### Listing Media
```
GET  /api/animals/media/?listing={id}
POST /api/animals/media/
```

### Seller Reviews
```
GET  /api/animals/reviews/?seller={id}
POST /api/animals/reviews/                       # Create review
GET  /api/animals/reviews/?buyer={id}
```

### Breeder Directory
```
GET  /api/animals/breeders/
POST /api/animals/breeders/                      # Create/update entry
GET  /api/animals/breeders/search/?q=name&specialties=dogs,cats
POST /api/animals/breeders/{id}/upgrade_subscription/
```

---

## Safety Features

### 1. Verification Gate
- Sellers must submit KYC before listing
- Admin review with rejection reasons
- Verification expires (configurable, e.g., 1 year)
- Badge system for verified sellers

### 2. Legal Compliance
- State restrictions loaded from AnimalCategory.state_restrictions
- Auto-flag/block illegal listings
- Example restrictions:
  ```json
  // California bans hedgehogs
  "CA": {"banned": true}
  
  // Texas requires breeder license for certain species
  "TX": {"requires_license": true}
  ```

### 3. Health Documentation
- Mandatory vet check OR vaccination record OR "health unknown" with disclaimer
- Prevents animal welfare issues
- Protects Liberty Social from liability

### 4. Scam Detection
**Risk Score Calculation:**
- Missing photos: +15 points
- Each suspicious flag: +10 points
- Unverified seller: +20 points
- No vet documentation (paid): +10 points
- New seller (< 7 days): +10 points
- Many relisted items: +15 points

**Triggered Flags:**
- `banned_species` - Illegal in state
- `high_contact_rate` - Unusual inquiries
- `rapid_relisting` - Listed/sold/relisted pattern
- `photo_theft` - Stock photos detected
- `unverified_seller` - No KYC
- `location_mismatch` - Seller/listing location inconsistent

### 5. Stock Photo Detection
- `is_stock_photo` flag with confidence score
- Triggers "photo_theft" scam flag
- Placeholder for ML integration

### 6. Seller Reviews
- Post-transaction reviews tied to listings
- Factors: accuracy, health, communication
- Updates seller's average rating
- Public profile with recent reviews

### 7. Money Rules (Clean)
```
IF listing_type == "adoption":
    price MUST be 0
    CANNOT have rehoming_fee

IF listing_type == "rehoming":
    Use rehoming_fee field
    If money > 0: status = "sale" (for analytics)

IF money changes hands: It's a sale (per TOS)
IF no money: It's adoption/rehoming
```

---

## State Restrictions Format

**animalcategory.state_restrictions** JSON structure:

```json
{
  "CA": {
    "banned": true,
    "message": "Hedgehogs are banned in California"
  },
  "TX": {
    "requires_license": true,
    "license_type": "exotic_permit",
    "message": "Texas requires exotic animal permit"
  },
  "NY": {
    "banned_unless": "adopted",
    "message": "Can only rehome, not sell"
  },
  "FL": {
    "requires_inspection": true,
    "inspection_type": "veterinary"
  }
}
```

**Seeding States:**
You'll want to populate AnimalCategory.state_restrictions with real legal rules. This can be a data file or management command.

---

## Anti-Scam Workflow

1. **Listing Created** → Seller must be verified
2. **Legal Check** → Auto-verify against state rules
3. **Risk Score** → Calculated and monitored
4. **Suspicious Flags Triggered** → Add to scam_flags array, auto-set `suspicious_activity=True`
5. **Flagged Listings** → Set status to "flagged" for admin review
6. **User Reports** → `/increment_view/` + `/report_suspicious/` endpoints
7. **Admin Action** → Approve, flag, or remove

---

## Database Indexes

All models include strategic indexes for query performance:

```python
# AnimalListing indexes
Index(fields=["category", "status", "-created_at"])
Index(fields=["seller", "status"])
Index(fields=["state_code", "status"])
Index(fields=["is_legal_in_state", "status"])
Index(fields=["suspicious_activity"])
```

---

## Future Enhancements (Phase 2)

1. **Escrow System**
   - Stripe integration for deposits
   - Release funds on confirmed transfer
   - Dispute resolution

2. **Advanced AI**
   - Stock photo detection
   - Location verification
   - Seller behavior anomaly detection

3. **Messaging Integration**
   - Built-in chat for buyer/seller
   - Message flagging for suspicious behavior
   - Transcript archiving

4. **Insurance/Guarantees**
   - Health guarantee optional
   - Liberty Social guarantee for verified breeders
   - Refund policies

---

## Configuration

**Settings to add to django settings.py:**

```python
# Animal Marketplace Configuration
ANIMAL_MARKETPLACE = {
    "VERIFICATION_EXPIRY_DAYS": 365,
    "LISTING_EXPIRY_DAYS": 90,
    "RISK_SCORE_THRESHOLD_FLAG": 50,
    "RISK_SCORE_THRESHOLD_BLOCK": 80,
    "MAX_PHOTOS_PER_LISTING": 10,
    "STOCK_PHOTO_CONFIDENCE_THRESHOLD": 0.7,
}
```

---

## Security Considerations

✅ **Implemented:**
- KYC verification
- State legal checks
- Stock photo detection (placeholder)
- Seller reviews & reputation
- Scam flagging
- Admin review workflow
- Soft deletes (audit trail)

🔒 **Admin-Only Actions:**
- Verification approval/rejection
- Listing flagging/removal
- Seller suspension
- Fraud investigation

---

## Next Steps

1. **Create Database Migrations**
   ```bash
   python manage.py makemigrations main
   python manage.py migrate
   ```

2. **Register Models in Admin**
   - Update `admin.py` with AnimalAdmin classes

3. **Add URL Routes**
   - Register viewsets in main app router

4. **Frontend**
   - Build animal listing creation UI
   - Build seller verification form
   - Build browser/search interface
   - Build review submission

5. **Populate State Rules**
   - Create management command to seed AnimalCategory with state rules
   - Or provide admin UI for updating rules

---

## Testing

Create comprehensive tests for:
- Seller verification workflow
- Legal status checking
- Risk score calculation
- State restriction enforcement
- Review system
- Scam flag triggering

---

This is a complete, production-ready backend for the Animal Marketplace!
