import logging
from .base import BaseEvaluator, EvaluatorResult

logger = logging.getLogger(__name__)


class DNSEvaluator(BaseEvaluator):
    def check(self, scan_id: int, params: dict) -> EvaluatorResult:
        from startScan.models import Vulnerability

        finding_name = params.get('finding_name', '')
        if not finding_name:
            return EvaluatorResult(matches=False, confidence='LOW', evidence=[])

        any_email_findings = Vulnerability.objects.filter(
            scan_history_id=scan_id,
            source='email_security',
        ).exists()
        if not any_email_findings:
            return EvaluatorResult(matches=False, confidence='LOW', evidence=[])

        qs = Vulnerability.objects.filter(
            scan_history_id=scan_id,
            source='email_security',
            name__icontains=finding_name,
        )

        findings = list(qs.values('id', 'name', 'severity', 'http_url')[:20])
        if not findings:
            return EvaluatorResult(matches=False, confidence='HIGH', evidence=[])

        evidence = [
            {
                'id': f['id'],
                'description': f"{f['name']} on {f['http_url'] or 'N/A'}",
                'detail': f,
            }
            for f in findings
        ]
        return EvaluatorResult(matches=True, confidence='HIGH', evidence=evidence)
