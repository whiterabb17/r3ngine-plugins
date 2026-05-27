from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
import json
import re

@dataclass
class Finding:
    id: int
    name: str
    vuln_type: str  # sqli, xss, rce, lfi, etc.
    url: str
    method: str = "GET"
    params: Dict[str, Any] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    initial_confidence: float = 0.0
    severity: int = 0
    raw_vulnerability: Any = None

class Normalizer:
    """
    Normalizes findings from reNgine Vulnerability model into a unified Finding schema.
    """
    
    TYPE_MAP = {
        'sql_injection': 'sqli',
        'cross_site_scripting': 'xss',
        'remote_code_execution': 'rce',
        'local_file_inclusion': 'lfi',
        # Add more mappings as needed
    }

    def normalize(self, vuln) -> Finding:
        # Determine vuln type
        vuln_type = self._detect_type(vuln.name, vuln.type)
        
        # Parse method and params from request if available
        method, params, headers = self._parse_request(vuln.request)
        
        return Finding(
            id=vuln.id,
            name=vuln.name,
            vuln_type=vuln_type,
            url=vuln.http_url,
            method=method,
            params=params,
            headers=headers,
            initial_confidence=vuln.correlation_score or 0.5,
            severity=vuln.severity,
            raw_vulnerability=vuln
        )

    def _detect_type(self, name: str, type_str: str) -> str:
        combined = f"{name} {type_str}".lower()
        if 'sql' in combined and 'inject' in combined:
            return 'sqli'
        if 'xss' in combined or 'cross-site scripting' in combined:
            return 'xss'
        if 'rce' in combined or 'remote code' in combined:
            return 'rce'
        if 'lfi' in combined or 'file inclusion' in combined:
            return 'lfi'
        return 'unknown'

    def _parse_request(self, request_str: str) -> tuple:
        method = "GET"
        params = {}
        headers = {}
        
        if not request_str:
            return method, params, headers

        # Simple heuristic to parse raw HTTP request or curl-like strings
        lines = request_str.strip().split('\n')
        if not lines:
            return method, params, headers

        first_line = lines[0].strip()
        # Check if it looks like an HTTP request line (e.g. GET /path HTTP/1.1)
        match = re.match(r'^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)\s+HTTP/\d\.\d$', first_line, re.IGNORECASE)
        if match:
            method = match.group(1).upper()
            # Headers follow
            for line in lines[1:]:
                if ':' in line:
                    k, v = line.split(':', 1)
                    headers[k.strip()] = v.strip()
                elif line.strip() == "":
                    # Body starts after empty line
                    break
        
        return method, params, headers
