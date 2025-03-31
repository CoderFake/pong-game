from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from PongGame.views import LanguageOptionsAPIView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/game/', include('game.urls')),
    path('api/chat/', include('chat.urls')),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('api/languages/', LanguageOptionsAPIView.as_view(), name='language-options'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)