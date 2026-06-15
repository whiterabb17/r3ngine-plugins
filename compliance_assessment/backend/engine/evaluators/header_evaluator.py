import json
import logging
from .base import BaseEvaluator, EvaluatorResult

logger = logging.getLogger(__name__)


class HeaderEvaluator(BaseEvaluator):
    def check(self, scan_id: int, params: dict) -> EvaluatorResult:
        from startScan.models import Screenshot

        header_name = params.get('header_name', '').lower()
        must_exist = params.get('must_exist', True)

        if not header_name:
            return EvaluatorResult(matches=False, confidence='LOW', evidence=[])

        screenshots = Screenshot.objects.filter(
            scan_history_id=scan_id,
        ).values('id', 'url', 'response_headers')[:200]

        matching = []
        for shot in screenshots:
            headers = shot.get('response_headers') or {}
            if isinstance(headers, str):
                try:
                    headers = json.loads(headers)
                except Exception:
                    headers = {}
            header_present = any(k.lower() == header_name for k in headers)
            if must_exist and not header_present:
                matching.append({
                    'id': shot['id'],
                    'description': f"Missing {header_name} header on {shot['url']}",
                    'detail': {'url': shot['url'], 'header': header_name, 'present': False},
                })
            elif not must_exist and header_present:
                val = next((v for k, v in headers.items() if k.lower() == header_name), '')
                matching.append({
                    'id': shot['id'],
                    'description': f"{header_name} found on {shot['url']}: {val}",
                    'detail': {'url': shot['url'], 'header': header_name, 'value': val},
                })

        if not matching:
            return EvaluatorResult(matches=False, confidence='MEDIUM', evidence=[])
        return EvaluatorResult(matches=True, confidence='MEDIUM', evidence=matching[:20])
