from django.test import TestCase
from rest_framework.test import APIClient
from users.models import User, Friends, UserSettings
from .models import Notification


class MainAppTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(email='u1@example.com', password='pass', username='u1')
        self.user2 = User.objects.create_user(email='u2@example.com', password='pass', username='u2')
        UserSettings.objects.create(user=self.user1)
        UserSettings.objects.create(user=self.user2)
        # make them friends for feed tests
        Friends.objects.create(user=self.user1, friend=self.user2)
        Friends.objects.create(user=self.user2, friend=self.user1)

    def test_create_post_and_feed(self):
        self.client.force_authenticate(user=self.user1)
        # create a post
        resp = self.client.post('/api/posts/', {'content': 'Hello world', 'visibility': 'friends'}, format='json')
        self.assertEqual(resp.status_code, 201)
        post_id = resp.data.get('id')

        # user2 should see it in feed
        self.client.force_authenticate(user=self.user2)
        resp_feed = self.client.get('/api/feed/')
        self.assertEqual(resp_feed.status_code, 200)
        feed_data = resp_feed.data.get('results') if isinstance(resp_feed.data, dict) and 'results' in resp_feed.data else resp_feed.data
        self.assertTrue(any(item.get('id') == post_id for item in feed_data))

    def test_react_and_comment(self):
        self.client.force_authenticate(user=self.user1)
        post_resp = self.client.post('/api/posts/', {'content': 'Post for interactions', 'visibility': 'public'}, format='json')
        self.assertEqual(post_resp.status_code, 201)
        post_id = post_resp.data.get('id')

        # comment
        comment_resp = self.client.post('/api/comments/', {'post': post_id, 'content': 'Nice post!'}, format='json')
        self.assertEqual(comment_resp.status_code, 201)

        # reaction
        react_resp = self.client.post('/api/reactions/', {'post': post_id, 'reaction_type': 'love'}, format='json')
        self.assertEqual(react_resp.status_code, 201)

        # notification should be created for the post owner (none in this test since author==user1 -> create another reaction by user2)
        self.client.force_authenticate(user=self.user2)
        react_resp2 = self.client.post('/api/reactions/', {'post': post_id, 'reaction_type': 'like'}, format='json')
        self.assertEqual(react_resp2.status_code, 201)
        # now user1 should have a notification
        self.client.force_authenticate(user=self.user1)
        notif_resp = self.client.get('/api/notifications/')
        self.assertEqual(notif_resp.status_code, 200)
        data = notif_resp.data.get('results') if isinstance(notif_resp.data, dict) and 'results' in notif_resp.data else notif_resp.data
        self.assertTrue(len(data) >= 1)

