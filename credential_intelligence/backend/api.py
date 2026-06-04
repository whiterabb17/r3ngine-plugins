from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from .models import CredentialTask, DiscoveredCredential
from .serializers import CredentialTaskSerializer, DiscoveredCredentialSerializer

class ExecuteActionThrottle(UserRateThrottle):
    rate = '10/min'

class CredentialTaskViewSet(viewsets.ModelViewSet):
    queryset = CredentialTask.objects.all().order_by('-created_at')
    serializer_class = CredentialTaskSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], throttle_classes=[ExecuteActionThrottle])
    def execute(self, request, pk=None):
        task = self.get_object()
        
        if task.status in ['running', 'completed']:
            return Response({'error': 'Task is already running or completed'}, status=400)
            
        task.status = 'running'
        task.save()
        
        # Temporal Dispatch logic will go here
        
        return Response({'status': 'Workflow dispatched', 'task_id': task.id})

class DiscoveredCredentialViewSet(viewsets.ModelViewSet):
    queryset = DiscoveredCredential.objects.all().order_by('-discovered_at')
    serializer_class = DiscoveredCredentialSerializer
    permission_classes = [IsAuthenticated]
