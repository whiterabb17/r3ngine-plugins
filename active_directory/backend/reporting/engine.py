# r3ngine-plugins/active_directory/backend/reporting/engine.py
from __future__ import annotations
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class ReportingEngine:
    """Compile a structured report dict from an ADAssessment's DB records."""

    @classmethod
    def compile(cls, assessment_id: int) -> dict:
        from ..models import ADAssessment
        assessment = ADAssessment.objects.get(pk=assessment_id)
        return {
            'metadata': cls._metadata(assessment),
            'executive_summary': cls._executive_summary(assessment),
            'domain_inventory': cls._domain_inventory(assessment),
            'trust_analysis': cls._trust_analysis(assessment),
            'exposure_analysis': cls._exposure_analysis(assessment),
            'findings': cls._findings(assessment),
            'timeline': cls._timeline(assessment),
        }

    @staticmethod
    def _metadata(assessment) -> dict:
        return {
            'report_id': f"AD-{assessment.id}-{assessment.target_domain}",
            'target_domain': assessment.target_domain,
            'assessment_name': assessment.name,
            'status': assessment.status,
            'generated_at': timezone.now().isoformat(),
            'started_at': assessment.started_at.isoformat() if assessment.started_at else None,
            'completed_at': assessment.completed_at.isoformat() if assessment.completed_at else None,
        }

    @staticmethod
    def _executive_summary(assessment) -> dict:
        from django.db.models import Count, Avg
        severity_counts = dict(
            assessment.findings.values('severity')
            .annotate(count=Count('id'))
            .values_list('severity', 'count')
        )
        avg_trust_risk = assessment.trusts.aggregate(avg=Avg('risk_score'))['avg'] or 0.0
        avg_exposure_risk = assessment.exposures.aggregate(avg=Avg('risk_score'))['avg'] or 0.0
        return {
            'domain_count': assessment.domains.count(),
            'trust_count': assessment.trusts.count(),
            'exposure_count': assessment.exposures.count(),
            'finding_counts': {sev: severity_counts.get(sev, 0)
                               for sev in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')},
            'average_trust_risk': round(avg_trust_risk, 2),
            'average_exposure_risk': round(avg_exposure_risk, 2),
            'critical_findings': list(
                assessment.findings.filter(severity='CRITICAL')
                .values('title', 'affected_object', 'finding_type')[:10]
            ),
        }

    @staticmethod
    def _domain_inventory(assessment) -> list:
        return list(
            assessment.domains.values(
                'name', 'fqdn', 'sid', 'forest_root', 'functional_level',
                'dc_count', 'user_count', 'group_count', 'computer_count',
            )
        )

    @staticmethod
    def _trust_analysis(assessment) -> list:
        return [
            {
                'source': t.source_domain.fqdn or t.source_domain.name,
                'target': t.target_domain_name,
                'type': t.trust_type,
                'direction': t.direction,
                'is_transitive': t.is_transitive,
                'is_selective_auth': t.is_selective_auth,
                'risk_score': t.risk_score,
            }
            for t in assessment.trusts.select_related('source_domain').all()
        ]

    @staticmethod
    def _exposure_analysis(assessment) -> list:
        return [
            {
                'hostname': e.hostname,
                'ip_address': e.ip_address,
                'port': e.port,
                'type': e.exposure_type,
                'risk_score': e.risk_score,
                'correlated_domain': e.correlated_domain.fqdn if e.correlated_domain else None,
            }
            for e in assessment.exposures.select_related('correlated_domain').all()
        ]

    @staticmethod
    def _findings(assessment) -> list:
        return list(
            assessment.findings.values(
                'title', 'description', 'severity', 'status',
                'finding_type', 'affected_object', 'remediation', 'created_at',
            ).order_by('severity', '-created_at')
        )

    @staticmethod
    def _timeline(assessment) -> list:
        try:
            from ..models import ADEvidenceLog
            entries = ADEvidenceLog.objects.filter(assessment=assessment).order_by('timestamp')
            return [
                {
                    'timestamp': e.timestamp.isoformat(),
                    'event_type': e.event_type,
                    'actor': e.actor,
                    'details': e.details,
                }
                for e in entries
            ]
        except Exception:
            return []
