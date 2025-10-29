from rest_framework.serializers import ModelSerializer, CharField, Serializer
from .models import User, UserSettings

class LoginSerializer(ModelSerializer):
    username = CharField(required=True)
    class Meta:
        model = User
        fields = ["username", "password"]
        
class RegisterUserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", 'phone_number', 'password']
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ['id']
        
    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        user_settings = UserSettings(user=user)
        user_settings.save()
        return user
        
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = "__all__"
        
