#!/usr/bin/env python3
"""
Verification script for global call implementation.
Run this to verify all necessary code is in place.
"""

import os
import sys

def check_file_contains(filepath, search_strings, description):
    """Check if a file contains all the required strings."""
    print(f"\n{'='*60}")
    print(f"Checking: {description}")
    print(f"File: {filepath}")
    print(f"{'='*60}")

    if not os.path.exists(filepath):
        print(f"❌ FAILED: File not found: {filepath}")
        return False

    with open(filepath, 'r') as f:
        content = f.read()

    all_found = True
    for search_string in search_strings:
        if search_string in content:
            print(f"✅ Found: {search_string[:80]}...")
        else:
            print(f"❌ MISSING: {search_string[:80]}...")
            all_found = False

    if all_found:
        print(f"\n✅ {description} - PASSED")
    else:
        print(f"\n❌ {description} - FAILED")

    return all_found

def main():
    print("="*60)
    print("GLOBAL CALL IMPLEMENTATION VERIFICATION")
    print("="*60)

    base_dir = os.path.dirname(os.path.abspath(__file__))

    checks = []

    # Check 1: ChatConsumer - call.offer routing
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_offer(self, content):',
            '# Send to conversation group (existing behavior)',
            '# ALSO send to receiver\'s global notification WebSocket',
            'receiver_notification_group = notification_group_name(str(receiver_id))',
            '"type": "call_offer"',
        ],
        "ChatConsumer - call.offer routing to global notification"
    ))

    # Check 2: ChatConsumer - call.answer routing
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_answer(self, content):',
            '# ALSO send to caller\'s global notification WebSocket',
            'caller_notification_group = notification_group_name(str(caller_id))',
            '"type": "call_answer"',
        ],
        "ChatConsumer - call.answer routing to global notification"
    ))

    # Check 3: ChatConsumer - call.end routing
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_end(self, content):',
            '# ALSO send to other participant\'s global notification WebSocket',
            'other_notification_group = notification_group_name(str(other_user_id))',
            '"type": "call_end"',
        ],
        "ChatConsumer - call.end routing to global notification"
    ))

    # Check 4: NotificationConsumer - client message handlers
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'elif message_type == "call.offer":',
            'await self._handle_call_offer_from_client(content)',
            'elif message_type == "call.answer":',
            'await self._handle_call_answer_from_client(content)',
            'elif message_type == "call.end":',
            'await self._handle_call_end_from_client(content)',
        ],
        "NotificationConsumer - receive_json call message routing"
    ))

    # Check 5: NotificationConsumer - offer handler from client
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_offer_from_client(self, content):',
            'receiver_notification_group = notification_group_name(str(receiver_id))',
            'await self.channel_layer.group_send(',
        ],
        "NotificationConsumer - handle call.offer from client"
    ))

    # Check 6: NotificationConsumer - answer handler from client
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_answer_from_client(self, content):',
            'caller_notification_group = notification_group_name(str(caller_id))',
        ],
        "NotificationConsumer - handle call.answer from client"
    ))

    # Check 7: NotificationConsumer - end handler from client
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def _handle_call_end_from_client(self, content):',
            'other_notification_group = notification_group_name(str(other_user_id))',
        ],
        "NotificationConsumer - handle call.end from client"
    ))

    # Check 8: NotificationConsumer - channel layer handlers
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'consumers.py'),
        [
            'async def call_offer(self, event):',
            '"type": "call.offer"',
            'async def call_answer(self, event):',
            '"type": "call.answer"',
            'async def call_end(self, event):',
            '"type": "call.end"',
        ],
        "NotificationConsumer - channel layer to client handlers"
    ))

    # Check 9: NotificationSerializer - data field
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'serializers.py'),
        [
            'class NotificationSerializer',
            'data = serializers.SerializerMethodField()',
            '"data",',
        ],
        "NotificationSerializer - data field added"
    ))

    # Check 10: NotificationSerializer - get_data method
    checks.append(check_file_contains(
        os.path.join(base_dir, 'main', 'serializers.py'),
        [
            'def get_data(self, obj):',
            'if obj.verb in ["incoming_voice_call", "incoming_video_call"]:',
            '"conversation_id": str(call.conversation.id)',
        ],
        "NotificationSerializer - get_data method for calls"
    ))

    # Summary
    print("\n" + "="*60)
    print("VERIFICATION SUMMARY")
    print("="*60)

    passed = sum(checks)
    total = len(checks)

    print(f"\nPassed: {passed}/{total}")

    if passed == total:
        print("\n✅ ALL CHECKS PASSED - Ready for deployment!")
        print("\nNext steps:")
        print("1. Review changes: git diff main/consumers.py main/serializers.py")
        print("2. Commit changes: git add main/consumers.py main/serializers.py")
        print("3. Deploy: ./deploy.sh")
        return 0
    else:
        print(f"\n❌ SOME CHECKS FAILED - {total - passed} issues found")
        print("\nPlease review the failed checks above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
