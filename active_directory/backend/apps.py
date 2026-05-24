# r3ngine-plugins/active_directory/backend/apps.py
from django.apps import AppConfig


class BackendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'plugins_data.active_directory.backend'
    label = 'active_directory_backend'
    verbose_name = 'Active Directory Intelligence'
