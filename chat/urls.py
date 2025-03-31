from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    ChatRoomViewSet, MessageViewSet, DirectMessageViewSet,
    BlockedUserViewSet, UnreadMessagesView
)

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='chat-room')
router.register(r'direct-messages', DirectMessageViewSet, basename='direct-message')
router.register(r'blocked-users', BlockedUserViewSet, basename='blocked-user')

urlpatterns = [
    path('rooms/<str:room_name>/messages/', MessageViewSet.as_view({'get': 'list', 'post': 'create'}), name='room-messages'),
    path('unread-messages/', UnreadMessagesView.as_view(), name='unread-messages'),
]

urlpatterns += router.urls