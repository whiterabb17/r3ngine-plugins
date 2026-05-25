# r3ngine-plugins/active_directory/backend/api.py
import asyncio
import logging
import os
import uuid

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.pagination import PageNumberPagination
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


class ADPageNumberPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


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
        paginator = ADPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            return paginator.get_paginated_response(
                ADFindingSerializer(page, many=True).data)
        return Response(ADFindingSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='trusts')
    def trusts(self, request, pk=None):
        assessment = self.get_object()
        paginator = ADPageNumberPagination()
        page = paginator.paginate_queryset(assessment.trusts.all(), request)
        if page is not None:
            return paginator.get_paginated_response(
                ADTrustSerializer(page, many=True).data)
        return Response(ADTrustSerializer(assessment.trusts.all(), many=True).data)

    @action(detail=True, methods=['get'], url_path='exposures')
    def exposures(self, request, pk=None):
        assessment = self.get_object()
        paginator = ADPageNumberPagination()
        page = paginator.paginate_queryset(assessment.exposures.all(), request)
        if page is not None:
            return paginator.get_paginated_response(
                ADExposureSerializer(page, many=True).data)
        return Response(ADExposureSerializer(assessment.exposures.all(), many=True).data)

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

    @action(detail=True, methods=['get'], url_path='graph/domains')
    def graph_domains(self, request, pk=None):
        """Cytoscape-compatible domain + trust graph."""
        assessment = self.get_object()
        try:
            from .graph.manager import ADGraphManager
            with ADGraphManager() as mgr:
                data = mgr.get_domain_graph(assessment.id)
            return Response(data)
        except Exception as exc:
            return Response({'nodes': [], 'edges': [], 'error': str(exc)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='graph/exposures')
    def graph_exposures(self, request, pk=None):
        """Cytoscape-compatible exposure path graph."""
        assessment = self.get_object()
        try:
            from .graph.manager import ADGraphManager
            with ADGraphManager() as mgr:
                data = mgr.get_exposure_paths(assessment.id)
            return Response(data)
        except Exception as exc:
            return Response({'nodes': [], 'edges': [], 'error': str(exc)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='graph/path')
    def graph_path(self, request, pk=None):
        """Shortest path between two AD domain nodes."""
        source = request.query_params.get('source')
        target = request.query_params.get('target')
        if not source or not target:
            return Response(
                {'error': 'source and target query params required'},
                status=status.HTTP_400_BAD_REQUEST)
        assessment = self.get_object()
        try:
            from .graph.manager import ADGraphManager
            with ADGraphManager() as mgr:
                path = mgr.find_shortest_path(source, target, assessment.id)
            return Response({'path': path})
        except Exception as exc:
            return Response({'path': [], 'error': str(exc)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='report')
    def report(self, request, pk=None):
        """
        Generate and stream an assessment report.
        Query param: ?format=json (default) | pdf
        """
        assessment = self.get_object()
        fmt = request.query_params.get('format', 'json').lower()
        try:
            from .reporting.engine import ReportingEngine
            compiled = ReportingEngine.compile(assessment.id)
            import re
            safe_domain = re.sub(r'[^\w.\-]', '_', assessment.target_domain)
            if fmt == 'pdf':
                from .reporting.pdf_renderer import PDFRenderer
                from django.http import HttpResponse
                pdf_bytes = PDFRenderer.render(compiled)
                filename = f"ad-report-{assessment.id}-{safe_domain}.pdf"
                response = HttpResponse(pdf_bytes, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response
            else:
                from .reporting.json_renderer import JSONRenderer
                from django.http import HttpResponse
                json_bytes = JSONRenderer.render(compiled)
                filename = f"ad-report-{assessment.id}-{safe_domain}.json"
                response = HttpResponse(json_bytes, content_type='application/json')
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response
        except Exception as exc:
            logger.error(f"[AD Report] Generation failed: {exc}")
            return Response(
                {'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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
        tmp_path = None
        with tempfile.NamedTemporaryFile(
                delete=False, suffix=os.path.splitext(uploaded.name)[1]) as tmp:
            for chunk in uploaded.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            summary = ADAssessmentViewSet._run_ingestion(ingest_type, tmp_path, assessment.id)
        except Exception as exc:
            logger.error(f"[AD Ingest] Failed: {exc}")
            summary = {'error': str(exc)}
        finally:
            import os as _os
            if tmp_path and _os.path.exists(tmp_path):
                _os.remove(tmp_path)

        return Response({
            'status': 'completed',
            'file': uploaded.name,
            'type': ingest_type,
            'summary': summary,
        })

    @staticmethod
    def _run_ingestion(ingest_type: str, file_path: str, assessment_id: int) -> dict:
        import zipfile
        import tempfile
        import shutil

        ingest_type = ingest_type.lower()

        if file_path.endswith('.zip'):
            extract_dir = tempfile.mkdtemp()
            try:
                with zipfile.ZipFile(file_path, 'r') as zf:
                    for member in zf.infolist():
                        if os.path.isabs(member.filename) or '..' in member.filename.split('/'):
                            raise ValueError(f"Unsafe path in zip archive: {member.filename}")
                    zf.extractall(extract_dir)
                return ADAssessmentViewSet._run_ingestion(
                    ingest_type, extract_dir, assessment_id)
            finally:
                shutil.rmtree(extract_dir, ignore_errors=True)

        if os.path.isdir(file_path):
            files = os.listdir(file_path)
            if any(f in files for f in
                   ['domain_users.json', 'domain_groups.json', 'domain_computers.json']):
                ingest_type = 'ldap'
            elif any(f in files for f in
                     ['users.json', 'groups.json', 'computers.json']):
                ingest_type = 'bloodhound'

        if ingest_type in ('ldap', 'ldapdomaindump'):
            from .ingestion.ldap_parser import LDAPParser
            directory = file_path if os.path.isdir(file_path) else os.path.dirname(file_path)
            return LDAPParser.ingest_from_directory(directory, assessment_id)

        if ingest_type in ('bloodhound', 'bh'):
            from .ingestion.bloodhound_parser import BloodHoundParser
            directory = file_path if os.path.isdir(file_path) else os.path.dirname(file_path)
            return BloodHoundParser.ingest_from_directory(directory, assessment_id)

        return {'warning': f'Unknown ingest type: {ingest_type}. Supported: ldap, bloodhound'}
