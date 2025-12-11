#!/usr/bin/env python
"""
Test script for Passkey Backend Endpoints

Usage:
    python test_passkey_endpoints.py

Make sure Django server is running: python manage.py runserver
"""

import os
import sys
import django
import requests
import json

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")
django.setup()

from users.models import User

# Configuration
API_BASE = os.getenv("API_BASE", "http://localhost:8000/api")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def test_login():
    """Test login to get access token"""
    print_section("1. Testing Login")
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login/",
            json={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=5
        )
        
        if response.status_code == 200:
            tokens = response.json()
            access_token = tokens.get("access_token")
            user_id = tokens.get("user_id")
            print(f"✅ Login successful")
            print(f"   User ID: {user_id}")
            print(f"   Token: {access_token[:30]}..." if access_token else "   No token")
            return access_token, user_id
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None, None

def test_passkey_status(access_token):
    """Test passkey status endpoint"""
    print_section("2. Testing Passkey Status")
    
    try:
        response = requests.get(
            f"{API_BASE}/auth/passkey/status/",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status retrieved")
            print(f"   Has passkey: {data.get('has_passkey')}")
            print(f"   Credentials count: {len(data.get('credentials', []))}")
            return data
        else:
            print(f"❌ Status failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Status error: {e}")
        return None

def test_register_begin(access_token):
    """Test passkey registration begin endpoint"""
    print_section("3. Testing Passkey Registration Begin")
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/passkey/register/begin/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "device_name": "Test Device",
                "device_info": {
                    "platform": "Web",
                    "browser": "Chrome",
                    "user_agent": "Mozilla/5.0 (Test)"
                }
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Registration begin successful")
            print(f"   Challenge: {data.get('challenge', 'N/A')[:30]}...")
            print(f"   RP ID: {data.get('rp_id')}")
            print(f"   RP Origin: {data.get('rp_origin')}")
            print(f"   Options keys: {list(data.get('options', {}).keys())}")
            return data
        else:
            print(f"❌ Registration begin failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Registration begin error: {e}")
        return None

def test_authenticate_begin(email):
    """Test passkey authentication begin endpoint"""
    print_section("4. Testing Passkey Authentication Begin")
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/passkey/authenticate/begin/",
            headers={"Content-Type": "application/json"},
            json={"email": email},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Authentication begin successful")
            print(f"   Challenge: {data.get('challenge', 'N/A')[:30]}...")
            print(f"   RP ID: {data.get('rp_id')}")
            return data
        elif response.status_code == 400:
            error = response.json().get('error', 'Unknown error')
            print(f"⚠️  Authentication begin (expected if no passkey): {error}")
            return None
        else:
            print(f"❌ Authentication begin failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Authentication begin error: {e}")
        return None

def test_remove_passkey(access_token, credential_id):
    """Test passkey removal endpoint"""
    print_section("5. Testing Passkey Removal")
    
    try:
        response = requests.delete(
            f"{API_BASE}/auth/passkey/remove/{credential_id}/",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"✅ Passkey removed successfully")
            return True
        else:
            print(f"❌ Removal failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Removal error: {e}")
        return False

def check_database(user_id):
    """Check database state"""
    print_section("6. Checking Database")
    
    try:
        user = User.objects.get(id=user_id)
        print(f"✅ User found: {user.email}")
        print(f"   Has passkey: {user.has_passkey}")
        
        credentials = user.passkey_credentials.all()
        print(f"   Credentials count: {credentials.count()}")
        
        for cred in credentials:
            print(f"   - {cred.device_name} (created: {cred.created_at})")
        
        return True
    except User.DoesNotExist:
        print(f"❌ User not found: {user_id}")
        return False
    except Exception as e:
        print(f"❌ Database check error: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("  PASSKEY BACKEND TESTING")
    print("="*60)
    print(f"\nAPI Base: {API_BASE}")
    print(f"Test Email: {TEST_EMAIL}")
    print("\nNote: Make sure Django server is running!")
    print("      python manage.py runserver")
    
    # Test 1: Login
    access_token, user_id = test_login()
    if not access_token:
        print("\n❌ Cannot proceed without access token. Please check login credentials.")
        return
    
    # Test 2: Check status
    status_data = test_passkey_status(access_token)
    
    # Test 3: Begin registration
    register_data = test_register_begin(access_token)
    
    # Test 4: Begin authentication (should fail if no passkey)
    auth_data = test_authenticate_begin(TEST_EMAIL)
    
    # Test 5: Check database
    check_database(user_id)
    
    print_section("Summary")
    print("✅ Basic endpoint tests completed")
    print("\n📝 Next Steps:")
    print("   1. Test full registration flow with WebAuthn client")
    print("   2. Test full authentication flow with WebAuthn client")
    print("   3. Verify credentials are stored correctly")
    print("\n💡 To test full flow, use a browser with WebAuthn support")
    print("   or implement the frontend/mobile client.")

if __name__ == "__main__":
    main()

