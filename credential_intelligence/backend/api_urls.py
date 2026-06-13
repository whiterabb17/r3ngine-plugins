from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import CredentialTaskViewSet, DiscoveredCredentialViewSet
from .cracking_views import HashCrackingTaskViewSet

router = DefaultRouter()
router.register(r'tasks', CredentialTaskViewSet, basename='credential-task')
router.register(r'credentials', DiscoveredCredentialViewSet, basename='discovered-credential')
router.register(r'cracking', HashCrackingTaskViewSet, basename='hash-cracking')

urlpatterns = [
    path('', include(router.urls)),
]
