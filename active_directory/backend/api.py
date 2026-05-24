# r3ngine-plugins/active_directory/backend/api.py
import asyncio
import logging
import os
import uuid

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import (ADAssessment, ADDomain, ADExposure, ADFinding,
                     ADGraphSnapshot, ADTrust)
from .serializers import (ADAssessmentCreateSerializer,
                          ADAssessmentDetailSerializer,
                          ADAssessmentListSerializer, ADExposureSerializer,
                          ADFindingSerializer, ADGraphSnapshotSerializer,
                          ADTrustSerializer)

logger = logging.getLogger(__name__)


class ADAssessmentViewSet(viewsets.ModelViewSet):
    queryset = ADAssessment.objects.all()
    lookup_field = 'pk'

    def get_serializer_class(self):
        if self.action == 'create':
            return ADAssessmentCreateSerializer
        if self.action in ('retrieve', 'update', 'partial_update'):
            return ADAssessmentDetailSerializer
        return ADAssessmentListSerializer

    # ------------------------------------------------------------------
    # Start / Cancel
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        """Start the ADAssessmentWorkflow for this assessment."""
        assessment = self.get_object()
        if assessment.status not in ('PENDING', 'FAILED', 'CANCELLED'):
            return Response(
                {'error': f'Cannot start an assessment in {assessment.status} state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workflow_id = f"ad-assessment-{assessment.id}-{uuid.uuid4().hex[:8]}"

        try:
            wf_id = self._start_workflow(assessment, workflow_id)
            assessment.workflow_id = wf_id
            assessment.status = 'PENDING'
            assessment.save(update_fields=['workflow_id', 'status'])
            return Response({'workflow_id': wf_id, 'status': 'started'})
        except Exception as exc:
            logger.error(f"[AD API] Failed to start workflow: {exc}")
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _start_workflow(self, assessment, workflow_id: str) -> str:
        from reNgine.temporal_client import TemporalClientProvider
        from .temporal_exports import ADAssessmentWorkflow

        loop = asyncio.new_event_loop()
        try:
            async def _run():
                client = await TemporalClientProvider.get_client()
                handle = await client.start_workflow(
                    ADAssessmentWorkflow.run,
                    {
                        'assessment_id': assessment.id,
                        'target_domain': assessment.target_domain,
                        'config': assessment.config,
                    },
                    id=workflow_id,
                    task_queue='python-orchestrator-queue',
                )
                return handle.id
            return loop.run_until_complete(_run())
        finally:
            loop.close()

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Cancel a running ADAssessmentWorkflow."""
        assessment = self.get_object()
        if not assessment.workflow_id:
            return Response(
                {'error': 'No active workflow to cancel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from reNgine.temporal_client import TemporalClientProvider
            TemporalClientProvider.cancel_workflow(assessment.workflow_id)
            assessment.status = 'CANCELLED'
            assessment.completed_at = timezone.now()
            assessment.save(update_fields=['status', 'completed_at'])
            return Response({'status': 'cancelled'})
        except Exception as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ------------------------------------------------------------------
    # Sub-resource endpoints
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='findings')
    def findings(self, request, pk=None):
        assessment = self.get_object()
        severity = request.query_params.get('severity')
        qs = assessment.findings.all()
        if severity:
            qs = qs.filter(severity=severity.upper())
        return Response(ADFindingSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='trusts')
    def trusts(self, request, pk=None):
        assessment = self.get_object()
        return Response(
            ADTrustSerializer(assessment.trusts.all(), many=True).data)

    @action(detail=True, methods=['get'], url_path='exposures')
    def exposures(self, request, pk=None):
        assessment = self.get_object()
        return Response(
            ADExposureSerializer(assessment.exposures.all(), many=True).data)

    @action(detail=True, methods=['get', 'post'], url_path='graph-snapshot')
    def graph_snapshot(self, request, pk=None):
        assessment = self.get_object()
        if request.method == 'GET':
            snapshot_type = request.query_params.get('type')
            qs = assessment.graph_snapshots.all()
            if snapshot_type:
                qs = qs.filter(snapshot_type=snapshot_type)
            return Response(ADGraphSnapshotSerializer(qs[:1], many=True).data)
        serializer = ADGraphSnapshotSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(assessment=assessment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='ingest',
            parser_classes=[MultiPartParser])
    def ingest(self, request, pk=None):
        """
        Accept data file upload for ingestion (LDAP export, BloodHound JSON).
        Full ingestion pipelines implemented in Phase 2.
        """
        assessment = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided.'},
                            status=status.HTTP_400_BAD_REQUEST)

        uploaded = request.FILES['file']
        ingest_type = request.data.get('type', 'auto')

        import tempfile
        with tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(uploaded.name)[1]) as tmp:
            for chunk in uploaded.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        return Response({
            'status': 'queued',
            'file': uploaded.name,
            'type': ingest_type,
            'tmp_path': tmp_path,
            'message': 'File received. Ingestion pipeline runs in Phase 2.',
        })
