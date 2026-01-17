#!/usr/bin/env python
"""
Quick test to check if Nathan's password works
"""
import os
import sys
import django

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")
django.setup()

from users.models import User

email = "nathan@membershipauto.com"
user = User.objects.get(email=email)

print(f"\n{'='*60}")
print(f"PASSWORD TEST FOR: {email}")
print(f"{'='*60}\n")

# Get password from user
test_password = input("Enter Nathan's current password to test: ")

# Test it
if user.check_password(test_password):
    print("\n✅ PASSWORD IS CORRECT - Login should work!")
    print("\n   The issue is NOT the password.")
    print("   Possible causes:")
    print("   - User is entering email with extra spaces")
    print("   - User is using different capitalization")
    print("   - Browser autocomplete issue")
    print("   - Network/API issue")
else:
    print("\n❌ PASSWORD IS INCORRECT")
    print("\n   The password hash in database doesn't match.")
    print("   Solutions:")
    print("   1. Reset password via password reset flow")
    print("   2. Or manually set a new password:")
    print(f"\n   from users.models import User")
    print(f"   user = User.objects.get(email='{email}')")
    print(f"   user.set_password('NEW_PASSWORD_HERE')")
    print(f"   user.save()")

print(f"\n{'='*60}\n")
