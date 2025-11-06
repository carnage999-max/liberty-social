import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "liberty_social.settings")

app = Celery("liberty_social")

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
