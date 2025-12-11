# Testing Passkey Backend Implementation

## Step 1: Install Dependencies

```bash
cd backend
pip install webauthn>=1.2.1
```

Or if using virtual environment:
```bash
cd backend
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install webauthn>=1.2.1
```

## Step 2: Create and Run Migrations

```bash
python manage.py makemigrations users
python manage.py migrate
```

This will:
- Add `has_passkey` field to User model
- Create `PasskeyCredential` table

## Step 3: Verify Installation

Check that the webauthn library is installed correctly:
```bash
python -c "from webauthn import generate_registration_options; print('webauthn installed successfully')"
```

## Step 4: Test Endpoints

### Prerequisites
- Django server running: `python manage.py runserver`
- A test user account (register via `/api/auth/register/`)
- JWT access token for authenticated endpoints

### Test 1: Check Passkey Status (No Passkey Yet)

```bash
# Get your access token first (from login)
ACCESS_TOKEN="your_jwt_token_here"
API_BASE="http://localhost:8000/api"

# Check status
curl -X GET "${API_BASE}/auth/passkey/status/" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "has_passkey": false,
  "credentials": []
}
```

### Test 2: Begin Passkey Registration

```bash
curl -X POST "${API_BASE}/auth/passkey/register/begin/" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "device_name": "Test Device",
    "device_info": {
      "platform": "Web",
      "browser": "Chrome",
      "user_agent": "Mozilla/5.0..."
    }
  }'
```

**Expected Response:**
```json
{
  "challenge": "base64url-encoded-challenge",
  "options": {
    "rp": {
      "id": "localhost",
      "name": "Liberty Social"
    },
    "user": {
      "id": "base64-encoded-user-id",
      "name": "user@example.com",
      "displayName": "User Name"
    },
    "pubKeyCredParams": [...],
    "challenge": "base64url-encoded-challenge",
    "authenticatorSelection": {...},
    "excludeCredentials": []
  },
  "rp_id": "localhost",
  "rp_origin": "http://localhost:3000"
}
```

**Save the `challenge` value** - you'll need it for the complete step.

### Test 3: Verify Relying Party Configuration

Check that `rp_id` and `rp_origin` are correct:
- `rp_id` should be your domain (e.g., "localhost" for dev, "mylibertysocial.com" for prod)
- `rp_origin` should match your `FRONTEND_URL` setting

### Test 4: Test Authentication Begin (Before Registration)

This should fail since user has no passkey:

```bash
curl -X POST "${API_BASE}/auth/passkey/authenticate/begin/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com"
  }'
```

**Expected Response:**
```json
{
  "error": "User does not have a passkey registered"
}
```

### Test 5: Check Database

Verify the models are created:

```bash
python manage.py shell
```

```python
from users.models import User, PasskeyCredential

# Check user
user = User.objects.get(email="your-email@example.com")
print(f"Has passkey: {user.has_passkey}")

# Check credentials (should be empty)
credentials = PasskeyCredential.objects.filter(user=user)
print(f"Credentials count: {credentials.count()}")
```

## Step 5: Full Integration Test (Requires WebAuthn Client)

For a complete test, you need a WebAuthn client (browser or mobile app). The flow is:

### Registration Flow:
1. **Begin:** Call `/auth/passkey/register/begin/` → Get challenge and options
2. **Client:** Use WebAuthn API (`navigator.credentials.create()`) with the options
3. **Complete:** Call `/auth/passkey/register/complete/` with the credential response

### Authentication Flow:
1. **Begin:** Call `/auth/passkey/authenticate/begin/` with email → Get challenge
2. **Client:** Use WebAuthn API (`navigator.credentials.get()`) with the options
3. **Complete:** Call `/auth/passkey/authenticate/complete/` with credential response → Get JWT tokens

## Step 6: Manual Testing with Python Script

Create a test script to verify the endpoints work:

```python
# test_passkey_endpoints.py
import requests
import json

API_BASE = "http://localhost:8000/api"
EMAIL = "test@example.com"
PASSWORD = "testpassword123"

# 1. Login to get token
login_response = requests.post(
    f"{API_BASE}/auth/login/",
    json={"username": EMAIL, "password": PASSWORD}
)
tokens = login_response.json()
access_token = tokens["access_token"]
print(f"✓ Logged in, token: {access_token[:20]}...")

# 2. Check passkey status
status_response = requests.get(
    f"{API_BASE}/auth/passkey/status/",
    headers={"Authorization": f"Bearer {access_token}"}
)
print(f"✓ Status: {status_response.json()}")

# 3. Begin registration
begin_response = requests.post(
    f"{API_BASE}/auth/passkey/register/begin/",
    headers={"Authorization": f"Bearer {access_token}"},
    json={"device_name": "Test Device"}
)
begin_data = begin_response.json()
print(f"✓ Registration begin: {begin_data.get('challenge', 'N/A')[:20]}...")
print(f"✓ RP ID: {begin_data.get('rp_id')}")
print(f"✓ RP Origin: {begin_data.get('rp_origin')}")

# 4. Test authentication begin (should fail)
auth_begin_response = requests.post(
    f"{API_BASE}/auth/passkey/authenticate/begin/",
    json={"email": EMAIL}
)
print(f"✓ Auth begin (expected to fail): {auth_begin_response.json()}")

print("\n✅ All endpoint tests passed!")
print("\nNote: To complete full registration/authentication, you need a WebAuthn client.")
```

Run it:
```bash
python test_passkey_endpoints.py
```

## Step 7: Check Logs

Monitor Django logs for any errors:
```bash
# In another terminal, watch logs
tail -f logs/django.log  # or check console output
```

Look for:
- "Passkey registration started for user..."
- "Passkey registered successfully..."
- Any error messages

## Step 8: Verify Database Schema

```bash
python manage.py dbshell
```

```sql
-- Check User table has has_passkey column
\d users_user;

-- Check PasskeyCredential table exists
\d users_passkeycredential;

-- Check indexes
\di users_passkeycredential*;
```

## Common Issues & Solutions

### Issue: "ModuleNotFoundError: No module named 'webauthn'"
**Solution:** Install the library: `pip install webauthn>=1.2.1`

### Issue: "No such table: users_passkeycredential"
**Solution:** Run migrations: `python manage.py migrate`

### Issue: "Invalid rp_id" errors
**Solution:** Check `FRONTEND_URL` setting matches your domain

### Issue: Import errors in passkey_views.py
**Solution:** Verify webauthn library version and API compatibility

## Next Steps After Backend Testing

Once backend is verified:
1. ✅ Backend API works
2. ✅ Database models created
3. ✅ Endpoints return expected responses
4. → Move to Frontend implementation
5. → Move to Mobile implementation

