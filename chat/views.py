from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from django.utils import timezone
from .models import ChatRoom, Message, DirectMessage, BlockedUser
from .serializers import (
    ChatRoomSerializer, MessageSerializer,
    DirectMessageSerializer, BlockedUserSerializer
)


class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.all()


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(room__name=self.kwargs.get('room_name'))

    def perform_create(self, serializer):
        room_name = self.kwargs.get('room_name')
        room, created = ChatRoom.objects.get_or_create(name=room_name)
        serializer.save(room=room, sender=self.request.user)


class DirectMessageViewSet(viewsets.ModelViewSet):
    serializer_class = DirectMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return DirectMessage.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()

        if message.recipient != request.user:
            return Response(
                {"error": "You can only mark messages addressed to you as read"},
                status=status.HTTP_403_FORBIDDEN
            )

        message.read = True
        message.save()

        return Response(DirectMessageSerializer(message).data)


class BlockedUserViewSet(viewsets.ModelViewSet):
    serializer_class = BlockedUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BlockedUser.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UnreadMessagesView(generics.ListAPIView):
    serializer_class = DirectMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DirectMessage.objects.filter(
            recipient=self.request.user,
            read=False
        ).order_by('-created_at')