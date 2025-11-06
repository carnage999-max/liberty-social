try:
    from .celery import app as celery_app
except ModuleNotFoundError:  # pragma: no cover - allows manage.py during install
    celery_app = None

__all__ = ("celery_app",)
