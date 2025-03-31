"""
ASGI config for PongGame project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

from game.consumers import GameConsumer
from chat.consumers import ChatConsumer, DirectChatConsumer

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "PongGame.settings")

django_asgi_app = get_asgi_application()

import PongGame.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                PongGame.routing.websocket_urlpatterns
            )
        )
    ),
})