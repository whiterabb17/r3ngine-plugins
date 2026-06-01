from django.apps import AppConfig


class BackendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'plugins_data.email_security.backend'
    label = 'email_security_backend'
    verbose_name = 'Email Security'
