from django.contrib.auth import login, logout, authenticate, get_user_model
from rest_framework import generics, permissions, status, viewsets, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import (
    UserSerializer, RegisterSerializer, UpdateUserSerializer,
    FriendshipSerializer, FriendRequestCreateSerializer, MatchSerializer
)
from .models import Friendship, Match
from django.db.models import Q


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)

        if user:
            login(request, user)
            user.is_online = True
            user.save()
            serializer = UserSerializer(user)
            return Response(serializer.data)
        return Response({"error": "Tên đăng nhập hoặc mật khẩu không đúng!"}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    def post(self, request):
        user = request.user
        if user.is_authenticated:
            user.is_online = False
            user.save()
            logout(request)
        return Response(status=status.HTTP_200_OK)


class UserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UpdateUserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveAPIView):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'


class AvatarUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if 'avatar' not in request.FILES:
            return Response({"error": "No avatar file provided"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.avatar = request.FILES['avatar']
        user.save()

        return Response(UserSerializer(user).data)


class FriendshipViewSet(viewsets.ModelViewSet):
    serializer_class = FriendshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Friendship.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return FriendRequestCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        serializer.save()


class AcceptFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(pk=pk, to_user=request.user, status='pending')
            friendship.status = 'accepted'
            friendship.save()
            return Response(FriendshipSerializer(friendship).data)
        except Friendship.DoesNotExist:
            return Response({"error": "Friend request does not exist"}, status=status.HTTP_404_NOT_FOUND)


class RejectFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(pk=pk, to_user=request.user, status='pending')
            friendship.status = 'rejected'
            friendship.save()
            return Response(FriendshipSerializer(friendship).data)
        except Friendship.DoesNotExist:
            return Response({"error": "Friend request does not exist"}, status=status.HTTP_404_NOT_FOUND)


class FriendsListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        friend_ids = Friendship.objects.filter(
            (Q(from_user=user) | Q(to_user=user)) & Q(status='accepted')
        ).values_list(
            'from_user', 'to_user'
        )

        friend_ids_flat = set()
        for from_id, to_id in friend_ids:
            friend_ids_flat.add(from_id)
            friend_ids_flat.add(to_id)

        friend_ids_flat.discard(user.id)

        return get_user_model().objects.filter(id__in=friend_ids_flat)


class MatchHistoryView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Match.objects.filter(
            Q(player1=user) | Q(player2=user),
            is_finished=True
        )