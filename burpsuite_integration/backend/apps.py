from django.apps import AppConfig


class BurpsuiteIntegrationConfig(AppConfig):
    """
    Django AppConfig for the Burp Suite Integration plugin.

    The label MUST follow the plugin system convention: {slug}_backend
    The name MUST be: plugins_data.{slug}.backend
    """

    name = "plugins_data.burpsuite_integration.backend"
    label = "burpsuite_integration_backend"
    verbose_name = "Burp Suite Integration"
