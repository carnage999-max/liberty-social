#!/usr/bin/env python
"""
Test that login works with different email cases
"""
import os
import sys
import django

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")
django.setup()

from users.models import User

email_variants = [
    "nathan@membershipauto.com",
    "Nathan@membershipauto.com",
    "NATHAN@membershipauto.com",
    "nAtHaN@membershipauto.com",
]

password = "Securepassword123!"

print(f"\n{'='*60}")
print(f"TESTING EMAIL CASE-INSENSITIVE LOGIN")
print(f"{'='*60}\n")

for email in email_variants:
    print(f"Testing: {email}")

    # Normalize email like the login view does
    normalized_email = email.strip().lower()
    print(f"  Normalized to: {normalized_email}")

    # Try to find user
    user = User.objects.filter(email=normalized_email).first()

    if user:
        print(f"  ✅ User found: {user.email}")

        # Test password
        if user.check_password(password):
            print(f"  ✅ Password is correct - LOGIN WOULD SUCCEED")
        else:
            print(f"  ❌ Password is incorrect - LOGIN WOULD FAIL")
    else:
        print(f"  ❌ User not found - LOGIN WOULD FAIL")

    print()

print(f"{'='*60}\n")
