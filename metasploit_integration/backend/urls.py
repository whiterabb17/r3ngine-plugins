from django.urls import path, include
from rest_framework.routers import DefaultRouter
try:
    from plugins_data.metasploit_integration.backend.views import (
        MetasploitWorkspaceViewSet, MetasploitTaskViewSet, MetasploitFindingViewSet
    )
except ImportError:
    from .views import MetasploitWorkspaceViewSet, MetasploitTaskViewSet, MetasploitFindingViewSet

router = DefaultRouter()
router.register(r'workspaces', MetasploitWorkspaceViewSet, basename='metasploit-workspace')
router.register(r'tasks', MetasploitTaskViewSet, basename='metasploit-task')
router.register(r'findings', MetasploitFindingViewSet, basename='metasploit-finding')

urlpatterns = [
    path('', include(router.urls)),
]
