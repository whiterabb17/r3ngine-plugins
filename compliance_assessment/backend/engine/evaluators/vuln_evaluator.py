import logging
from .base import BaseEvaluator, EvaluatorResult

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    'info': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4,
}


class VulnEvaluator(BaseEvaluator):
    def check(self, scan_id: int, params: dict) -> EvaluatorResult:
        from startScan.models import Vulnerability

        qs = Vulnerability.objects.filter(scan_history_id=scan_id)

        severity = params.get('severity')
        if severity:
            sev_int = SEVERITY_MAP.get(severity.lower())
            if sev_int is not None:
                qs = qs.filter(severity=sev_int)

        min_cvss = params.get('min_cvss')
        if min_cvss is not None:
            qs = qs.filter(cvss_score__gte=float(min_cvss))

        cwe = params.get('cwe')
        if cwe:
            qs = qs.filter(cwe_ids__name=cwe)

        nuclei_tag = params.get('nuclei_tag')
        if nuclei_tag:
            qs = qs.filter(tags__name__icontains=nuclei_tag)

        vulns = list(qs.values('id', 'name', 'severity', 'cvss_score', 'http_url').distinct()[:50])
        if not vulns:
            return EvaluatorResult(matches=False, confidence='HIGH', evidence=[])

        evidence = [
            {
                'id': v['id'],
                'description': f"{v['name']} (CVSS {v['cvss_score'] or 'N/A'}) on {v['http_url'] or 'N/A'}",
                'detail': v,
            }
            for v in vulns
        ]
        return EvaluatorResult(matches=True, confidence='HIGH', evidence=evidence)
