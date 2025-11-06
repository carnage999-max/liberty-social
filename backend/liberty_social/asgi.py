import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")

import django
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from liberty_social.auth import JWTAuthMiddlewareStack
import liberty_social.routing


django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddlewareStack(
            AllowedHostsOriginValidator(
                URLRouter(liberty_social.routing.websocket_urlpatterns)
            )
        ),
    }
)
