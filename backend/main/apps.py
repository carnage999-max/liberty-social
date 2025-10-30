from django.apps import AppConfig


class MainConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "main"

    def ready(self):
        # import signals to wire them
        try:
            import main.signals  # noqa: F401
        except Exception:
            pass
