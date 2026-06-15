import logging
from .base import BaseEvaluator, EvaluatorResult

logger = logging.getLogger(__name__)


class PortEvaluator(BaseEvaluator):
    def check(self, scan_id: int, params: dict) -> EvaluatorResult:
        from startScan.models import Port

        port_numbers = params.get('port_numbers', [])
        service_name = params.get('service_name', '').lower()
        banner_contains = params.get('banner_contains', '')

        # Traversal: Port → (ports reverse M2M) → IpAddress → (ip_addresses reverse M2M) → Subdomain → FK → ScanHistory
        qs = Port.objects.filter(
            ports__ip_addresses__scan_history_id=scan_id,
        ).distinct()

        if port_numbers:
            qs = qs.filter(number__in=[int(p) for p in port_numbers])
        if service_name:
            qs = qs.filter(service_name__icontains=service_name)
        if banner_contains:
            qs = qs.filter(description__icontains=banner_contains)

        ports = list(qs.values('id', 'number', 'service_name', 'description')[:50])
        if not ports:
            return EvaluatorResult(matches=False, confidence='MEDIUM', evidence=[])

        evidence = [
            {
                'id': p['id'],
                'description': f"Port {p['number']}/{p['service_name'] or 'unknown'} open",
                'detail': {'id': p['id'], 'number': p['number'], 'service_name': p['service_name']},
            }
            for p in ports
        ]
        return EvaluatorResult(matches=True, confidence='MEDIUM', evidence=evidence)
