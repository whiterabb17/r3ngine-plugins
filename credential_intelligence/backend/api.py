from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from api.permissions import IsPenetrationTester, IsAuditor
from .models import CredentialTask, DiscoveredCredential
from .serializers import CredentialTaskSerializer, DiscoveredCredentialSerializer
import logging

logger = logging.getLogger(__name__)

class ExecuteActionThrottle(UserRateThrottle):
    rate = '10/min'

class CredentialTaskViewSet(viewsets.ModelViewSet):
    queryset = CredentialTask.objects.all().order_by('-created_at')
    serializer_class = CredentialTaskSerializer
    permission_classes = [IsAuthenticated, IsPenetrationTester]

    @action(detail=True, methods=['post'], throttle_classes=[ExecuteActionThrottle])
    def execute(self, request, pk=None):
        task = self.get_object()
        
        if task.status in ['running', 'completed']:
            return Response({'error': 'Task is already running or completed'}, status=400)
            
        task.status = 'running'
        task.save()
        
        # Dispatch Temporal execution workflow asynchronously
        try:
            import asyncio
            from reNgine.temporal_client import TemporalClientProvider
            from django.utils import timezone
            
            async def _start():
                client = await TemporalClientProvider.get_client()
                await client.start_workflow(
                    "CredentialIntelligenceWorkflow",
                    {"task_id": task.id},
                    id=f"credential-intel-{task.id}-{int(timezone.now().timestamp())}",
                    task_queue="python-orchestrator-queue"
                )

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, _start())
                    future.result()
            else:
                loop.run_until_complete(_start())
        except Exception as e:
            logger.error(f"Failed to dispatch Temporal workflow for CredentialTask {task.id}: {e}")
            task.status = 'failed'
            task.error_message = f"Failed to dispatch Temporal workflow: {e}"
            task.save()
            return Response({'error': f'Failed to dispatch workflow: {e}'}, status=500)
        
        return Response({'status': 'Workflow dispatched', 'task_id': task.id})

class DiscoveredCredentialViewSet(viewsets.ModelViewSet):
    queryset = DiscoveredCredential.objects.all().order_by('-discovered_at')
    serializer_class = DiscoveredCredentialSerializer
    permission_classes = [IsAuthenticated, IsAuditor]
