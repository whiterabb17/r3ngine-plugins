from .base_adapter import BaseAdapter
from ..core.normalizer import Finding
from typing import Dict, Any

class XSStrikeAdapter(BaseAdapter):
    """
    Adapter for XSStrike validation (XSS).
    """
    
    def __init__(self, executor):
        super().__init__(executor)
        self.binary = "python3 /usr/src/app/plugins_data/exploit-readiness-layer/tools/XSStrike/xsstrike.py"

    def validate(self, finding: Finding) -> Dict[str, Any]:
        if finding.vuln_type != 'xss':
            return {'validated': False, 'error': "Finding is not XSS"}

        # XSStrike command
        # --crawl: not needed for single endpoint
        # -u: URL
        # --timeout: 10
        cmd = f"-u \"{finding.url}\" --timeout 10"
        
        # OpSec: User-Agent
        if self.opsec_manager.is_enabled() and self.opsec_manager.settings.enable_random_ua:
            ua = self.opsec_manager.get_random_ua()
            cmd += f" --headers \"User-Agent:{ua}\""
        
        exit_code, output = self._run_in_sandbox(cmd)
        
        # XSStrike output parsing
        # It usually outputs "Vulnerable" or "Reflections found"
        validated = "Vulnerable" in output or "Reflections found" in output
        
        confidence = 0.85 if "Vulnerable" in output else (0.6 if validated else 0.0)
        
        return {
            'validated': validated,
            'confidence': confidence,
            'payload': "See XSStrike logs",
            'request_evidence': "XSStrike validation attempt",
            'response_evidence': output[-2000:],
            'raw_output': output
        }
