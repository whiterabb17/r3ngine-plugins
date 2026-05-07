from .base_adapter import BaseAdapter
from ..core.normalizer import Finding
from typing import Dict, Any

class SqlmapAdapter(BaseAdapter):
    """
    Adapter for sqlmap validation.
    """
    
    def __init__(self, docker_manager):
        super().__init__(docker_manager)
        self.image = "paoloo/sqlmap"

    def validate(self, finding: Finding) -> Dict[str, Any]:
        if finding.vuln_type != 'sqli':
            return {'validated': False, 'error': "Finding is not SQLi"}

        # Construct safe sqlmap command
        # --batch: non-interactive
        # --level 1, --risk 1: safest checks
        # --random-agent: avoid simple blocking
        # -u: URL
        cmd = f"-u \"{finding.url}\" --batch --level 1 --risk 1 --random-agent"
        
        # If we have headers, add them
        if finding.headers:
            headers_str = ",".join([f"{k}:{v}" for k, v in finding.headers.items()])
            cmd += f" --headers=\"{headers_str}\""

        exit_code, output = self._run_in_sandbox(cmd)
        
        # Parse output for confirmation
        # sqlmap usually says "is vulnerable" or "appears to be vulnerable"
        validated = "is vulnerable" in output or "appears to be vulnerable" in output
        
        confidence = 0.9 if "is vulnerable" in output else (0.7 if validated else 0.0)
        
        # Extract payload if possible
        payload = ""
        if validated:
            import re
            payload_match = re.search(r"Payload: (.+)", output)
            if payload_match:
                payload = payload_match.group(1)

        return {
            'validated': validated,
            'confidence': confidence,
            'payload': payload,
            'request_evidence': "sqlmap validation attempt", # sqlmap doesn't easily give raw request/response in logs without -v 4
            'response_evidence': output[-2000:], # Last 2k chars of logs as evidence
            'raw_output': output
        }
