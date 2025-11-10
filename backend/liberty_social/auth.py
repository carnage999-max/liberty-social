from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.auth import AuthMiddlewareStack
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTAuthMiddleware:
    """Authenticate WebSocket connections via JWT access tokens."""

    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        token = self._get_token_from_scope(scope)

        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        
        # Get origin from headers
        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin")
        origin_str = origin.decode() if origin else "no origin header"
        
        logger.info(f"WebSocket connection attempt - token present: {bool(token)}, path: {scope.get('path', 'unknown')}, origin: {origin_str}")

        if token:
            user = await self._get_user(token)
            if user:
                scope["user"] = user
                logger.info(f"WebSocket authenticated user: {user.id}")
            else:
                scope["user"] = AnonymousUser()
                logger.warning("WebSocket token invalid or expired")
        else:
            scope.setdefault("user", AnonymousUser())
            logger.warning("WebSocket connection without token")

        return await self.inner(scope, receive, send)

    def _get_token_from_scope(self, scope):
        # Authorization header (Bearer <token>)
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization")
        if auth_header:
            try:
                prefix, supplied_token = auth_header.decode().split(" ", 1)
                if prefix.lower() == "bearer":
                    return supplied_token.strip()
            except ValueError:
                pass

        # Query string token
        query_string = scope.get("query_string", b"").decode()
        if query_string:
            params = parse_qs(query_string)
            token = params.get("token")
            if token:
                return token[0]
        return None

    async def _get_user(self, raw_token):
        try:
            validated = await sync_to_async(self.jwt_auth.get_validated_token)(raw_token)
            return await sync_to_async(self.jwt_auth.get_user)(validated)
        except Exception:
            return None


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
