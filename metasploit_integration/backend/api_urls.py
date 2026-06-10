from django.urls import path, include
from rest_framework.routers import DefaultRouter
try:
    from plugins_data.metasploit_integration.backend.views import (
        MetasploitWorkspaceViewSet, MetasploitTaskViewSet
    )
except ImportError:
    from .views import MetasploitWorkspaceViewSet, MetasploitTaskViewSet

router = DefaultRouter()
router.register(r'workspaces', MetasploitWorkspaceViewSet, basename='metasploit-workspace')
router.register(r'tasks', MetasploitTaskViewSet, basename='metasploit-task')

urlpatterns = [
    path('', include(router.urls)),
]
