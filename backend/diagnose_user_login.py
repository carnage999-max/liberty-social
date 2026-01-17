#!/usr/bin/env python
"""
Diagnostic script to check why a user cannot login.
Usage: python diagnose_user_login.py <user_email>
"""
import os
import sys
import django

# Setup Django
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")
django.setup()

from users.models import User, SecurityEvent
from django.utils import timezone
from datetime import timedelta


def diagnose_user(email):
    """Diagnose login issues for a specific user."""
    print(f"\n{'='*60}")
    print(f"DIAGNOSIS FOR: {email}")
    print(f"{'='*60}\n")

    # Normalize email
    email = email.strip().lower()

    # 1. Check if user exists
    user = User.objects.filter(email=email).first()
    if not user:
        print(f"❌ USER NOT FOUND")
        print(f"   Email searched: '{email}'")
        print(f"\n   Possible issues:")
        print(f"   - Email might have different capitalization in database")
        print(f"   - Email might have whitespace")
        print(f"   - User registered with different email")

        # Search for similar emails
        similar = User.objects.filter(email__icontains=email.split('@')[0])[:5]
        if similar:
            print(f"\n   Similar emails found:")
            for u in similar:
                print(f"   - {u.email}")
        return

    print(f"✅ User Found")
    print(f"   ID: {user.id}")
    print(f"   Email: {user.email}")
    print(f"   Username: {user.username}")
    print(f"   Active: {user.is_active}")
    print(f"   Staff: {user.is_staff}")
    print(f"   Superuser: {user.is_superuser}")

    # 2. Check if account is locked
    print(f"\n{'─'*60}")
    print("ACCOUNT STATUS")
    print(f"{'─'*60}")
    if user.account_locked_at:
        print(f"🔒 ACCOUNT IS LOCKED")
        print(f"   Locked at: {user.account_locked_at}")
        print(f"\n   TO UNLOCK:")
        print(f"   from users.models import User")
        print(f"   user = User.objects.get(email='{email}')")
        print(f"   user.account_locked_at = None")
        print(f"   user.save()")
    else:
        print(f"✅ Account is NOT locked")

    # 3. Check password
    print(f"\n{'─'*60}")
    print("PASSWORD STATUS")
    print(f"{'─'*60}")
    print(f"   Has usable password: {user.has_usable_password()}")
    if not user.has_usable_password():
        print(f"   ⚠️  Password is not usable (might be disabled or corrupted)")

    # 4. Check recent login attempts
    print(f"\n{'─'*60}")
    print("RECENT LOGIN ATTEMPTS (Last 7 days)")
    print(f"{'─'*60}")
    recent_time = timezone.now() - timedelta(days=7)
    events = SecurityEvent.objects.filter(
        user=user,
        timestamp__gte=recent_time
    ).order_by('-timestamp')[:10]

    if events:
        for event in events:
            emoji = "✅" if event.event_type == "login" else "❌"
            print(f"   {emoji} {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')} - {event.event_type}")
            if event.description:
                print(f"      {event.description}")
            if event.ip_address:
                print(f"      IP: {event.ip_address}")
    else:
        print(f"   No recent login attempts found")

    # 5. Check for failed logins
    failed_count = SecurityEvent.objects.filter(
        user=user,
        event_type='login_failed',
        timestamp__gte=recent_time
    ).count()

    print(f"\n   Failed login attempts (last 7 days): {failed_count}")

    # 6. Recommendations
    print(f"\n{'─'*60}")
    print("RECOMMENDATIONS")
    print(f"{'─'*60}")

    if user.account_locked_at:
        print(f"   1. ⚠️  UNLOCK the account (see command above)")

    if not user.has_usable_password():
        print(f"   2. ⚠️  Reset password - it's corrupted or disabled")

    if failed_count > 10:
        print(f"   3. ⚠️  Too many failed attempts - possible brute force or wrong password")

    if not user.is_active:
        print(f"   4. ⚠️  Account is not active - activate it")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnose_user_login.py <user_email>")
        sys.exit(1)

    email = sys.argv[1]
    diagnose_user(email)
