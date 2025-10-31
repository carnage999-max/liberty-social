from rest_framework import serializers
from .models import BlockedUsers, User, UserSettings, FriendRequest, Friends
from django.db import transaction


class LoginSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ["username", "password"]


class RegisterUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", 'phone_number', 'password', 'username']
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop("password")
        # Use the manager to create user (honors create_user logic)
        user = User.objects.create_user(password=password, **validated_data)
        UserSettings.objects.create(user=user)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Explicitly list common public fields instead of __all__ for safety
        fields = ["id", "email", "first_name", "last_name", "username", "phone_number", "profile_image_url", "bio", "gender"]
        read_only_fields = ["id", "email"]

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ["id", "user", "profile_privacy", "friends_publicity"]
        read_only_fields = ["id", "user"]

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)
    to_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), write_only=True, source="to_user"
    )

    class Meta:
        model = FriendRequest
        fields = ["id", "from_user", "to_user", "to_user_id", "status", "created_at"]
        read_only_fields = ["id", "from_user", "to_user", "status", "created_at"]

    def validate(self, attrs):
        request_user = self.context['request'].user
        to_user = attrs.get('to_user')
        if request_user == to_user:
            raise serializers.ValidationError("Cannot send a friend request to yourself.")
        if Friends.objects.filter(user=request_user, friend=to_user).exists():
            raise serializers.ValidationError("You are already friends with this user.")
        if FriendRequest.objects.filter(from_user=request_user, to_user=to_user, status='pending').exists() or FriendRequest.objects.filter(from_user=to_user, to_user=request_user, status='pending').exists():
            raise serializers.ValidationError("A pending friend request already exists between these users.")
        # ensure neither side has blocked the other
        if BlockedUsers.objects.filter(user=to_user, blocked_user=request_user).exists():
            raise serializers.ValidationError("You are blocked by this user.")
        if BlockedUsers.objects.filter(user=request_user, blocked_user=to_user).exists():
            raise serializers.ValidationError("You have blocked this user; unblock to send a request.")
        return attrs

    def create(self, validated_data):
        request_user = self.context['request'].user
        validated_data['from_user'] = request_user
        return super().create(validated_data)


class FriendsSerializer(serializers.ModelSerializer):
    friend = UserSerializer(read_only=True)
    friend_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True, source='friend')

    class Meta:
        model = Friends
        fields = ["id", "user", "friend", "friend_id", "created_at"]
        read_only_fields = ["id", "user", "friend", "created_at"]

    def create(self, validated_data):
        # Prefer creating friendships via FriendRequest accept flow; if used directly, ensure atomic creation of two rows
        user = self.context['request'].user
        friend = validated_data['friend']
        with transaction.atomic():
            f1, _ = Friends.objects.get_or_create(user=user, friend=friend)
            f2, _ = Friends.objects.get_or_create(user=friend, friend=user)
        return f1


class BlockedUsersSerializer(serializers.ModelSerializer):
    blocked_user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    user = UserSerializer(read_only=True)

    class Meta:
        model = BlockedUsers
        fields = ["id", "user", "blocked_user", "created_at"]
        read_only_fields = ["id", "user", "created_at"]

    def validate(self, attrs):
        request_user = self.context['request'].user
        blocked = attrs.get('blocked_user')
        if request_user == blocked:
            raise serializers.ValidationError("Cannot block yourself.")
        return attrs

    def create(self, validated_data):
        request_user = self.context['request'].user
        validated_data['user'] = request_user
        blocked = validated_data['blocked_user']
        # remove friendship if exists
        Friends.objects.filter(user=request_user, friend=blocked).delete()
        Friends.objects.filter(user=blocked, friend=request_user).delete()
        # cancel any pending friend requests between these users
        FriendRequest.objects.filter(from_user=request_user, to_user=blocked).delete()
        FriendRequest.objects.filter(from_user=blocked, to_user=request_user).delete()
        return super().create(validated_data)
