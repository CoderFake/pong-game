from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, LoginView, LogoutView, UserView, UserProfileView,
    AvatarUploadView, FriendshipViewSet, AcceptFriendRequestView,
    RejectFriendRequestView, FriendsListView, MatchHistoryView
)

router = DefaultRouter()
router.register(r'friendships', FriendshipViewSet, basename='friendship')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', UserView.as_view(), name='user-detail'),
    path('profile/<str:username>/', UserProfileView.as_view(), name='user-profile'),
    path('upload-avatar/', AvatarUploadView.as_view(), name='upload-avatar'),
    path('accept-friend-request/<int:pk>/', AcceptFriendRequestView.as_view(), name='accept-friend-request'),
    path('reject-friend-request/<int:pk>/', RejectFriendRequestView.as_view(), name='reject-friend-request'),
    path('friends/', FriendsListView.as_view(), name='friends-list'),
    path('match-history/', MatchHistoryView.as_view(), name='match-history'),
]

urlpatterns += router.urls