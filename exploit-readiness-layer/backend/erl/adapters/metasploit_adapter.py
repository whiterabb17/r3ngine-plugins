from .base_adapter import BaseAdapter
from ..core.normalizer import Finding
from typing import Dict, Any, Optional

class MetasploitAdapter(BaseAdapter):
    """
    Adapter for Metasploit validation (Check/Auxiliary only).
    """
    
    # Mapping of common vulnerability names/patterns to MSF modules
    MODULE_MAP = {
        'log4j': 'exploit/multi/http/log4shell_header_injection',
        'eternalblue': 'exploit/windows/smb/ms17_010_eternalblue',
        # Many more can be added
    }

    def __init__(self, docker_manager):
        super().__init__(docker_manager)
        self.image = "metasploitframework/metasploit-framework"

    def validate(self, finding: Finding) -> Dict[str, Any]:
        module = self._identify_module(finding)
        if not module:
            return {'validated': False, 'error': "No matching Metasploit module found for this finding."}

        # MSF command to run check only
        # msfconsole -q -x "use <module>; set RHOSTS <host>; set RPORT <port>; check; exit"
        from urllib.parse import urlparse
        parsed_url = urlparse(finding.url)
        host = parsed_url.hostname
        port = parsed_url.port or (443 if parsed_url.scheme == 'https' else 80)
        
        # Build resource file for MSF
        msf_commands = [
            f"use {module}",
            f"set RHOSTS {host}",
            f"set RPORT {port}",
            "check",
            "exit"
        ]
        cmd_str = " -q -x \"" + "; ".join(msf_commands) + "\""
        
        exit_code, output = self._run_in_sandbox(cmd_str)
        
        # MSF check usually returns "The target is vulnerable", "The target appears to be vulnerable", etc.
        validated = "is vulnerable" in output.lower() or "appears to be vulnerable" in output.lower()
        
        confidence = 0.95 if "is vulnerable" in output.lower() else (0.8 if validated else 0.0)
        
        return {
            'validated': validated,
            'confidence': confidence,
            'payload': f"MSF Module: {module}",
            'request_evidence': f"Metasploit check execution ({module})",
            'response_evidence': output[-2000:],
            'raw_output': output
        }

    def _identify_module(self, finding: Finding) -> Optional[str]:
        name = finding.name.lower()
        for pattern, module in self.MODULE_MAP.items():
            if pattern in name:
                return module
        return None
