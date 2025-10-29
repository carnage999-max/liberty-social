from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q
from .models import User
from .serializers import LoginSerializer, RegisterUserSerializer, UserSerializer


class LoginUserview(ModelViewSet):
    serializer_class = LoginSerializer
    http_method_names = ['post']
    
    def create(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = User.objects.filter(Q(email=username) | Q(phone_number=username) | Q(username=username)).first()
        if user and user.check_password(password):
            refresh_token = RefreshToken.for_user(user)
            return Response({
                'refresh_token': str(refresh_token),
                'access_token': str(refresh_token.access_token),
                'user_type': user.user_type
            }, status=status.HTTP_200_OK)
        return Response({"detail": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def LogoutView(request):
    try:
        refresh_token = request.data.get('refresh_token')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({"detail": "logout successful"}, status=status.HTTP_205_RESET_CONTENT)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
class RegisterUserViewSet(ModelViewSet):
    serializer_class = RegisterUserSerializer
    permission_classes = [AllowAny]
    http_method_names = ['post']
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(*args, **kwargs)
        refresh_token = RefreshToken.for_user(user)
        return Response({
            'user_id': user.id,
            'refresh_token': str(refresh_token),
            'access_token': str(refresh_token.access_token),
        }, status=status.HTTP_201_CREATED)
    
class UserView(ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    queryset = User.objects.all()
    http_method_names = ['get']
    
    def get_queryset(self):
        return super().get_queryset().filter(id=self.request.user.id)
