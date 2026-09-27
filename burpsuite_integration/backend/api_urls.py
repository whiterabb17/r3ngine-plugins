# Host loader expects backend/api_urls.py; re-export urls.py so the plugin mounts.
from .urls import urlpatterns  # noqa: F401

__all__ = ['urlpatterns']
