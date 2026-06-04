from django.apps import AppConfig

class CredentialIntelligenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'plugins_data.credential_intelligence.backend'
    label = 'credential_intelligence_backend'
    verbose_name = 'Credential Intelligence'
