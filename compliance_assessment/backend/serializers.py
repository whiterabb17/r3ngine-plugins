from rest_framework import serializers
from .models import ComplianceAssessment, ControlResult, ComplianceEvidence


class ComplianceEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceEvidence
        fields = ['id', 'evidence_type', 'evidence_id', 'description', 'detail']


class ControlResultSerializer(serializers.ModelSerializer):
    evidence = ComplianceEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = ControlResult
        fields = [
            'id', 'control_id', 'control_name', 'section',
            'result', 'confidence',
            'static_remediation', 'ai_remediation', 'ai_enriched_at',
            'evidence',
        ]


class ComplianceAssessmentSerializer(serializers.ModelSerializer):
    controls = ControlResultSerializer(many=True, read_only=True)

    class Meta:
        model = ComplianceAssessment
        fields = [
            'id', 'scan_history', 'framework', 'status',
            'pass_count', 'fail_count', 'partial_count', 'manual_count',
            'compliance_score',
            'html_report_path', 'pdf_report_path', 'attestation_path', 'attestation_hash',
            'created_at', 'completed_at',
            'controls',
        ]


class ComplianceAssessmentListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceAssessment
        fields = [
            'id', 'scan_history', 'framework', 'status',
            'pass_count', 'fail_count', 'partial_count', 'manual_count',
            'compliance_score', 'html_report_path', 'pdf_report_path',
            'attestation_path', 'created_at', 'completed_at',
        ]
