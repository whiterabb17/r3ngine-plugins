import re
from typing import Dict, Any, List
from .normalizer import Finding

class PolicyEngine:
    """
    Enforces safety policies and execution boundaries for ERL.
    """
    
    BLACKLISTED_PATHS = [
        r'/login',
        r'/logout',
        r'/admin',
        r'/delete',
        r'/reset',
        r'/register',
        r'/signup',
        r'/change-password',
        r'/forgot-password'
    ]

    def __init__(self, settings: Dict[str, Any] = None):
        self.settings = settings or {}
        self.max_rps = self.settings.get('max_rps', 5)
        self.max_cpu = self.settings.get('max_cpu', 0.5)
        self.max_mem = self.settings.get('max_mem', "256m")
        self.error_threshold = self.settings.get('error_threshold', 0.3)
        
        # In-memory tracking for kill switch (per target)
        self.error_counts = {}  # {target: {'total': 0, 'errors': 0}}

    def is_allowed(self, finding: Finding) -> (bool, str):
        """
        Check if a finding is allowed to be validated based on security policy.
        """
        # 1. Check Path Blacklist
        path = self._get_path(finding.url)
        for pattern in self.BLACKLISTED_PATHS:
            if re.search(pattern, path, re.IGNORECASE):
                return False, f"Path '{path}' is blacklisted (Policy: No interaction with sensitive endpoints)."

        # 2. Check Kill Switch
        target = self._get_target(finding.url)
        if self._is_kill_switch_active(target):
            return False, f"Kill switch active for target '{target}' (Error rate exceeded threshold)."

        return True, ""

    def record_execution(self, url: str, success: bool):
        """
        Record execution result for kill switch tracking.
        """
        target = self._get_target(url)
        if target not in self.error_counts:
            self.error_counts[target] = {'total': 0, 'errors': 0}
        
        stats = self.error_counts[target]
        stats['total'] += 1
        if not success:
            stats['errors'] += 1

    def get_sandbox_config(self) -> Dict[str, Any]:
        """
        Returns resource constraints for sandbox.
        """
        return {
            'cpu_quota': int(self.max_cpu * 100000),
            'mem_limit': self.max_mem,
            'network_mode': 'bridge',  # Default bridge, egress handled by DockerManager
            'rate_limit': self.max_rps
        }

    def _get_path(self, url: str) -> str:
        from urllib.parse import urlparse
        return urlparse(url).path

    def _get_target(self, url: str) -> str:
        from urllib.parse import urlparse
        return urlparse(url).netloc

    def _is_kill_switch_active(self, target: str) -> bool:
        stats = self.error_counts.get(target)
        if not stats or stats['total'] < 5:  # Minimum 5 attempts before kill switch kicks in
            return False
            
        error_rate = stats['errors'] / stats['total']
        return error_rate >= self.error_threshold
