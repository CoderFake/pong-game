
from django.urls import path, re_path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

from game.consumers import GameConsumer
from chat.consumers import ChatConsumer, DirectChatConsumer

websocket_urlpatterns = [
    path('ws/game/<str:game_id>/', GameConsumer.as_asgi()),
    path('ws/chat/<str:room_name>/', ChatConsumer.as_asgi()),
    path('ws/direct-chat/', DirectChatConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'websocket': AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})