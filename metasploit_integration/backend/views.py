from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from datetime import datetime, timezone
from django.utils.dateparse import parse_datetime

try:
    from plugins_data.metasploit_integration.backend.models import MetasploitWorkspace, MetasploitTask, MetasploitFinding
    from plugins_data.metasploit_integration.backend.serializers import (
        MetasploitWorkspaceSerializer, MetasploitTaskSerializer, MetasploitFindingSerializer
    )
except ImportError:
    from .models import MetasploitWorkspace, MetasploitTask, MetasploitFinding
    from .serializers import MetasploitWorkspaceSerializer, MetasploitTaskSerializer, MetasploitFindingSerializer

# RBAC: Custom permission class restricting access to staff/superusers (or pentesters)
class IsPentesterOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))

class MetasploitWorkspaceViewSet(viewsets.ModelViewSet):
    queryset = MetasploitWorkspace.objects.all().order_by('-created_at')
    serializer_class = MetasploitWorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]

class MetasploitTaskViewSet(viewsets.ModelViewSet):
    queryset = MetasploitTask.objects.all().order_by('-id')
    serializer_class = MetasploitTaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]

    def perform_create(self, serializer):
        task = serializer.save(started_at=datetime.now(timezone.utc), status='PENDING')
        
        # Trigger temporal workflow
        try:
            from reNgine.tasks import TemporalClient
            import asyncio
            
            async def trigger_workflow():
                client = await TemporalClient.get_client()
                await client.start_workflow(
                    "MetasploitTaskWorkflow",
                    task.id,
                    id=f"metasploit-task-{task.id}",
                    task_queue="r3ngine-plugin-tasks"
                )
                
            # Fire and forget or run until complete
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(trigger_workflow())
            loop.close()
            
        except Exception as e:
            task.status = 'FAILED'
            task.error_message = f"Failed to start workflow: {str(e)}"
            task.save()

class MetasploitFindingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MetasploitFinding.objects.all().order_by('-created_at')
    serializer_class = MetasploitFindingSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]
