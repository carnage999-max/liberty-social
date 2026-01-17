#!/usr/bin/env python
"""
Reset Nathan's password manually
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
print(f"RESETTING PASSWORD FOR: {email}")
print(f"{'='*60}\n")

# Set a temporary password
temp_password = "Securepassword123!"

print(f"Setting password: {temp_password}")
user.set_password(temp_password)
user.save()

print("\n✅ Password has been reset!")
print(f"\n   Email: {email}")
print(f"   Temporary Password: {temp_password}")
print("\n   Tell Nathan to:")
print("   1. Login with this temporary password")
print("   2. Immediately change it in account settings")

# Test the password
if user.check_password(temp_password):
    print("\n✅ Password verification PASSED - login will work!")
else:
    print("\n❌ WARNING: Password verification FAILED!")

print(f"\n{'='*60}\n")
