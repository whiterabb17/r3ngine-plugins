import os
import logging

from django.http import FileResponse, Http404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ComplianceAssessment, ControlResult
from .serializers import (
    ComplianceAssessmentSerializer,
    ComplianceAssessmentListSerializer,
    ControlResultSerializer,
)

logger = logging.getLogger(__name__)


class ComplianceAssessmentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ComplianceAssessment.objects.select_related('scan_history__domain')
        scan_id = self.request.query_params.get('scan_id')
        if scan_id:
            qs = qs.filter(scan_history_id=scan_id)
        framework = self.request.query_params.get('framework')
        if framework:
            qs = qs.filter(framework=framework)
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return ComplianceAssessmentListSerializer
        return ComplianceAssessmentSerializer

    @action(detail=True, methods=['get'], url_path='download/html')
    def download_html(self, request, pk=None):
        assessment = self.get_object()
        path = assessment.html_report_path
        if not path or not os.path.exists(path):
            raise Http404
        return FileResponse(open(path, 'rb'), content_type='text/html',
                            as_attachment=True, filename=os.path.basename(path))

    @action(detail=True, methods=['get'], url_path='download/pdf')
    def download_pdf(self, request, pk=None):
        assessment = self.get_object()
        path = assessment.pdf_report_path
        if not path or not os.path.exists(path):
            raise Http404
        return FileResponse(open(path, 'rb'), content_type='application/pdf',
                            as_attachment=True, filename=os.path.basename(path))

    @action(detail=True, methods=['get'], url_path='download/attestation')
    def download_attestation(self, request, pk=None):
        assessment = self.get_object()
        path = assessment.attestation_path
        if not path or not os.path.exists(path):
            raise Http404
        return FileResponse(open(path, 'rb'), content_type='application/json',
                            as_attachment=True, filename=os.path.basename(path))


class ControlResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ControlResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ControlResult.objects.prefetch_related('evidence')
        assessment_id = self.request.query_params.get('assessment_id')
        if assessment_id:
            qs = qs.filter(assessment_id=assessment_id)
        return qs.order_by('section', 'control_id')

    @action(detail=True, methods=['post'], url_path='enrich')
    def enrich(self, request, pk=None):
        ctrl = self.get_object()
        if ctrl.ai_remediation:
            return Response(
                {'detail': 'AI remediation already generated.', 'ai_remediation': ctrl.ai_remediation},
                status=status.HTTP_200_OK,
            )
        try:
            from plugins_data.compliance_assessment.backend.engine.llm_enricher import enrich_control_with_ai
            remediation = enrich_control_with_ai(ctrl.id)
            return Response({'ai_remediation': remediation}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error('LLM enrichment failed for control %s: %s', ctrl.control_id, exc)
            return Response({'detail': 'AI enrichment failed.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
