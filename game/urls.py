# Thêm vào game/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    GameViewSet, TournamentViewSet, ActiveTournamentMatchesView,
    ActiveTournamentsView, GameCustomizationAPIView
)

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')
router.register(r'tournaments', TournamentViewSet, basename='tournament')

urlpatterns = [
    path('active-matches/', ActiveTournamentMatchesView.as_view(), name='active-matches'),
    path('active-tournaments/', ActiveTournamentsView.as_view(), name='active-tournaments'),
    path('customization-options/', GameCustomizationAPIView.as_view(), name='customization-options'),
]

urlpatterns += router.urls