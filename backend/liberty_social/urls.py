"""
URL configuration for liberty_social project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from django.http import JsonResponse
import os


def health_check(_request):
    return JsonResponse({"status": "ok"})


def env_check(_request):
    """Diagnostic endpoint to check environment variables"""
    return JsonResponse(
        {
            "DEBUG_env": os.environ.get("DEBUG", "NOT_SET"),
            "ALLOWED_HOSTS_env": os.environ.get("ALLOWED_HOSTS", "NOT_SET"),
            "AWS_REGION_env": os.environ.get("AWS_REGION", "NOT_SET"),
            "DB_NAME_env": "SET" if os.environ.get("DB_NAME") else "NOT_SET",
            "SECRET_KEY_env": "SET" if os.environ.get("SECRET_KEY") else "NOT_SET",
        }
    )


urlpatterns = [
    path("", health_check, name="health-check"),
    path("env-check/", env_check, name="env-check"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/", include("main.urls")),
    # OpenAPI / Swagger
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]
