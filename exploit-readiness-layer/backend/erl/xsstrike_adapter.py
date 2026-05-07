from .base_adapter import BaseAdapter
from ..core.normalizer import Finding
from typing import Dict, Any

class XSStrikeAdapter(BaseAdapter):
    """
    Adapter for XSStrike validation (XSS).
    """
    
    def __init__(self, docker_manager):
        super().__init__(docker_manager)
        self.image = "s0md3v/xsstrike" # Assume this image exists or is built

    def validate(self, finding: Finding) -> Dict[str, Any]:
        if finding.vuln_type != 'xss':
            return {'validated': False, 'error': "Finding is not XSS"}

        # XSStrike command
        # --crawl: not needed for single endpoint
        # -u: URL
        # --blind: maybe too aggressive?
        # --timeout: 10
        cmd = f"-u \"{finding.url}\" --timeout 10"
        
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
