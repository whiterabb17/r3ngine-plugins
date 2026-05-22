from django.apps import AppConfig

class BackendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'plugins_data.erl_temporal.backend'
    label = 'erl_temporal_backend'
    verbose_name = 'ERL Temporal'
