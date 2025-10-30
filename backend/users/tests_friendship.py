from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, FriendRequest, Friends, BlockedUsers


class FriendshipFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(email='user1@example.com', password='pass1234', username='user1')
        self.user2 = User.objects.create_user(email='user2@example.com', password='pass1234', username='user2')
        # ensure user settings exist (created by Register flow in app but not when created directly in tests)
        UserSettings = __import__('users.models', fromlist=['UserSettings']).UserSettings
        UserSettings.objects.create(user=self.user1)
        UserSettings.objects.create(user=self.user2)

    def test_send_and_accept_friend_request(self):
        # user1 sends request to user2
        self.client.force_authenticate(user=self.user1)
        resp = self.client.post('/api/auth/friend-requests/', {'to_user': str(self.user2.id)}, format='json')
        self.assertEqual(resp.status_code, 201)
        fr_id = resp.data.get('id')
        self.assertIsNotNone(fr_id)

        # user2 accepts
        self.client.force_authenticate(user=self.user2)
        resp2 = self.client.post(f'/api/auth/friend-requests/{fr_id}/accept-friend-request/')
        self.assertEqual(resp2.status_code, 200)

        # check reciprocal friendship exists
        self.assertTrue(Friends.objects.filter(user=self.user1, friend=self.user2).exists())
        self.assertTrue(Friends.objects.filter(user=self.user2, friend=self.user1).exists())

    def test_block_user_removes_friendship(self):
        # create friendship first
        Friends.objects.create(user=self.user1, friend=self.user2)
        Friends.objects.create(user=self.user2, friend=self.user1)
        self.assertTrue(Friends.objects.filter(user=self.user1, friend=self.user2).exists())

        # user1 blocks user2
        self.client.force_authenticate(user=self.user1)
        resp = self.client.post('/api/auth/blocks/', {'blocked_user': str(self.user2.id)}, format='json')
        self.assertEqual(resp.status_code, 201)

        # friendships removed
        self.assertFalse(Friends.objects.filter(user=self.user1, friend=self.user2).exists())
        self.assertFalse(Friends.objects.filter(user=self.user2, friend=self.user1).exists())

    def test_incoming_outgoing_and_cancel_decline(self):
        # user1 sends request to user2
        self.client.force_authenticate(user=self.user1)
        resp = self.client.post('/api/auth/friend-requests/', {'to_user': str(self.user2.id)}, format='json')
        self.assertEqual(resp.status_code, 201)
        fr_id = resp.data.get('id')

        # outgoing list for user1
        resp_out = self.client.get('/api/auth/friend-requests/?direction=outgoing')
        self.assertEqual(resp_out.status_code, 200)
        out_data = resp_out.data.get('results') if isinstance(resp_out.data, dict) and 'results' in resp_out.data else resp_out.data
        self.assertTrue(any(str(self.user2.id) in str(item.get('to_user')) or item.get('id') == fr_id for item in out_data))

        # incoming list for user2
        self.client.force_authenticate(user=self.user2)
        resp_in = self.client.get('/api/auth/friend-requests/?direction=incoming')
        self.assertEqual(resp_in.status_code, 200)
        in_data = resp_in.data.get('results') if isinstance(resp_in.data, dict) and 'results' in resp_in.data else resp_in.data
        self.assertTrue(any(item.get('id') == fr_id for item in in_data))

        # decline as user2
        resp_decline = self.client.post(f'/api/auth/friend-requests/{fr_id}/decline/')
        self.assertEqual(resp_decline.status_code, 200)
        fr = FriendRequest.objects.filter(id=fr_id).first()
        self.assertIsNotNone(fr)
        self.assertEqual(fr.status, 'declined')

        # send again and cancel as sender
        self.client.force_authenticate(user=self.user1)
        resp2 = self.client.post('/api/auth/friend-requests/', {'to_user': str(self.user2.id)}, format='json')
        self.assertEqual(resp2.status_code, 201)
        fr_id2 = resp2.data.get('id')
        resp_cancel = self.client.post(f'/api/auth/friend-requests/{fr_id2}/cancel/')
        self.assertEqual(resp_cancel.status_code, 200)
        self.assertFalse(FriendRequest.objects.filter(id=fr_id2).exists())

    def test_unfriend_endpoint(self):
        # create friendship first
        f1 = Friends.objects.create(user=self.user1, friend=self.user2)
        f2 = Friends.objects.create(user=self.user2, friend=self.user1)
        self.assertTrue(Friends.objects.filter(user=self.user1, friend=self.user2).exists())

        # user1 removes friend via DELETE
        self.client.force_authenticate(user=self.user1)
        resp = self.client.delete(f'/api/auth/friends/{f1.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Friends.objects.filter(user=self.user1, friend=self.user2).exists())
        self.assertFalse(Friends.objects.filter(user=self.user2, friend=self.user1).exists())

    def test_block_cancels_pending_requests(self):
        # user1 sends request to user2
        self.client.force_authenticate(user=self.user1)
        resp = self.client.post('/api/auth/friend-requests/', {'to_user': str(self.user2.id)}, format='json')
        self.assertEqual(resp.status_code, 201)
        fr_id = resp.data.get('id')

        # user2 blocks user1
        self.client.force_authenticate(user=self.user2)
        resp_block = self.client.post('/api/auth/blocks/', {'blocked_user': str(self.user1.id)}, format='json')
        self.assertEqual(resp_block.status_code, 201)

        # friend request should be removed
        self.assertFalse(FriendRequest.objects.filter(id=fr_id).exists())

    def test_profile_privacy(self):
        # set user2 profile to private
        self.user2.user_settings.profile_privacy = 'private'
        self.user2.user_settings.save()

        # user1 should not be able to view user2 profile
        self.client.force_authenticate(user=self.user1)
        resp = self.client.get(f'/api/auth/user/{self.user2.id}/')
        self.assertEqual(resp.status_code, 403)

        # create friendship and try again
        Friends.objects.create(user=self.user2, friend=self.user1)
        Friends.objects.create(user=self.user1, friend=self.user2)
        resp2 = self.client.get(f'/api/auth/user/{self.user2.id}/')
        self.assertEqual(resp2.status_code, 200)
