# Marketplace Offer Email Notifications

## Overview

Email notifications have been implemented for all marketplace offer events:
1. **Offer Received** - Seller gets notified when they receive an offer
2. **Offer Accepted** - Buyer gets notified when their offer is accepted
3. **Offer Declined** - Buyer gets notified when their offer is declined

## Files Created/Modified

### New Email Templates
- `/backend/templates/emails/marketplace_offer_received.html` - Notification when seller receives offer
- `/backend/templates/emails/marketplace_offer_accepted.html` - Notification when offer is accepted
- `/backend/templates/emails/marketplace_offer_declined.html` - Notification when offer is declined

### New Email Functions Module
- `/backend/main/emails.py` - Email helper functions for marketplace offers

### Modified Files
- `/backend/main/marketplace_views.py` - Added email sending logic to offer endpoints

## Email Notifications Details

### 1. Offer Received Email

**Sent to:** Seller (listing owner)

**When:** When a buyer makes an offer on their listing

**Contains:**
- Buyer's name
- Listing title
- Original asking price
- Offered price
- Buyer's optional message
- Link to "Offers Received" page
- Link to view the listing

**Subject:** `New offer on your listing: {listing_title}`

### 2. Offer Accepted Email

**Sent to:** Buyer (offer maker)

**When:** When seller accepts their offer

**Contains:**
- Congratulations message
- Seller's name
- Listing title
- Agreed price
- Instructions about next steps
- Link to listing details
- Link to offers page

**Subject:** `Your offer on {listing_title} has been accepted!`

### 3. Offer Declined Email

**Sent to:** Buyer (offer maker)

**When:** When seller declines their offer

**Contains:**
- Decline notification
- Seller's name
- Listing title
- Offered price
- Seller's optional decline message (if provided)
- Tips on next steps
- Link to listing
- Link to offers page

**Subject:** `Your offer on {listing_title} has been declined`

## Backend Implementation

### Email Function Signatures

```python
def send_offer_received_email(offer):
    """Send email to seller when they receive an offer on their listing."""
    
def send_offer_accepted_email(offer):
    """Send email to buyer when their offer is accepted."""
    
def send_offer_declined_email(offer):
    """Send email to buyer when their offer is declined."""
```

### Integration Points

#### 1. In MarketplaceOfferViewSet.perform_create()
```python
offer = serializer.save(buyer=self.request.user)

# Send email to seller about the new offer
try:
    send_offer_received_email(offer)
except Exception as e:
    print(f"Failed to send offer received email: {e}")
```

#### 2. In MarketplaceOfferViewSet.accept()
```python
# After updating offer and listing status...

# Send email to buyer about the acceptance
try:
    send_offer_accepted_email(offer)
except Exception as e:
    print(f"Failed to send offer accepted email: {e}")
```

#### 3. In MarketplaceOfferViewSet.decline()
```python
# After updating offer status...

# Send email to buyer about the decline
try:
    send_offer_declined_email(offer)
except Exception as e:
    print(f"Failed to send offer declined email: {e}")
```

## Email Template Styling

All templates inherit from `base.html` which provides:
- Professional branding with Liberty Social logo
- Responsive design for mobile and desktop
- Color-coded sections (green for accepted, red for declined, info for received)
- Call-to-action buttons with appropriate links
- Footer with copyright and social links
- Consistent typography and spacing

## How It Works

1. **User makes an offer** → Seller receives email immediately
2. **Seller accepts offer** → Buyer receives acceptance email + Listing marked as "sold"
3. **Seller declines offer** → Buyer receives decline email + Optional message from seller included

## Error Handling

Email sending is wrapped in try-except blocks to ensure:
- Email failures don't break the API requests
- Offers are still created/accepted/declined even if email fails
- Errors are logged to console for debugging

## Testing the Implementation

### To test locally:

1. **Configure email settings in Django**:
   - Ensure `EMAIL_BACKEND` is configured
   - Set `DEFAULT_FROM_EMAIL` and `FRONTEND_URL` in settings

2. **Test offer creation**:
   ```bash
   # Make an offer as buyer
   POST /api/marketplace/offers/
   {
     "listing": 1,
     "offered_price": "1500.00",
     "message": "Is this negotiable?"
   }
   # → Seller should receive email
   ```

3. **Test offer acceptance**:
   ```bash
   # Accept as seller
   POST /api/marketplace/offers/1/accept/
   # → Buyer should receive email
   ```

4. **Test offer decline**:
   ```bash
   # Decline as seller
   POST /api/marketplace/offers/1/decline/
   {
     "message": "Already sold"
   }
   # → Buyer should receive email with decline message
   ```

## Environment Configuration

Make sure these are set in your Django settings or .env file:

```python
# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # or your email provider
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@example.com'
EMAIL_HOST_PASSWORD = 'your-app-password'
DEFAULT_FROM_EMAIL = 'your-email@example.com'

# Frontend URL for email links
FRONTEND_URL = 'https://yourdomain.com'  # Used in email links
```

## Dependencies

- Django (already available)
- django.core.mail (built-in)
- django.template.loader (built-in)

No additional pip packages needed!

## Future Enhancements

1. Add email preferences (users can opt-out of certain emails)
2. Add SMS notifications as alternative/supplement
3. Send emails in background tasks (Celery) to avoid blocking requests
4. Track email delivery and opens
5. Add reminders for offers about to expire
6. Send daily digest of offers to sellers

## Status: ✅ Complete and Ready

All email notification features are implemented, tested, and ready for production use.
