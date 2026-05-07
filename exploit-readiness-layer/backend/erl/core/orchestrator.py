import logging
from typing import List, Optional
from .normalizer import Normalizer, Finding
from .confidence_engine import ConfidenceEngine
from .policy_engine import PolicyEngine
from ..sandbox.docker_manager import DockerManager
from ..adapters.sqlmap_adapter import SqlmapAdapter
from ..adapters.xsstrike_adapter import XSStrikeAdapter
from ..adapters.metasploit_adapter import MetasploitAdapter
from startScan.models import Vulnerability, ValidationResult
from django.utils import timezone

logger = logging.getLogger(__name__)

class Orchestrator:
    """
    Main orchestrator for the Exploitation Readiness Layer (ERL).
    """
    
    def __init__(self):
        self.normalizer = Normalizer()
        self.confidence_engine = ConfidenceEngine()
        self.policy_engine = PolicyEngine()
        self.docker_manager = DockerManager()
        
        # Initialize adapters
        self.adapters = {
            'sqli': SqlmapAdapter(self.docker_manager),
            'xss': XSStrikeAdapter(self.docker_manager),
            'rce': MetasploitAdapter(self.docker_manager),
            'lfi': MetasploitAdapter(self.docker_manager) # MSF has LFI checks too
        }

    def process_scan(self, scan_history_id: int):
        """
        Processes all unverified vulnerabilities for a given scan.
        """
        vulns = Vulnerability.objects.filter(
            scan_history_id=scan_history_id,
            validation_status='unverified'
        )
        
        logger.info(f"ERL starting for scan {scan_history_id}. Found {vulns.count()} vulnerabilities to check.")
        
        for vuln in vulns:
            self.process_vulnerability(vuln)

    def process_vulnerability(self, vuln: Vulnerability):
        """
        Orchestrates the validation of a single vulnerability.
        """
        # 1. Normalize
        finding = self.normalizer.normalize(vuln)
        
        # 2. Initial Confidence Check
        initial_score = self.confidence_engine.calculate_initial_score(finding)
        vuln.correlation_score = initial_score
        vuln.save()
        
        if initial_score < 0.5:
            logger.info(f"Vulnerability {vuln.id} skipped: Initial confidence too low ({initial_score})")
            return

        # 3. Policy Check
        allowed, reason = self.policy_engine.is_allowed(finding)
        if not allowed:
            logger.warning(f"Vulnerability {vuln.id} blocked by policy: {reason}")
            return

        # 4. Select Adapter
        adapter = self.adapters.get(finding.vuln_type)
        if not adapter:
            logger.info(f"No adapter available for type '{finding.vuln_type}' (Vulnerability {vuln.id})")
            return

        # 5. Execute Validation
        logger.info(f"Validating vulnerability {vuln.id} ({finding.vuln_type}) using {adapter.__class__.__name__}")
        try:
            result = adapter.validate(finding)
            
            # Record execution for kill switch
            self.policy_engine.record_execution(finding.url, result.get('validated', False))
            
            # 6. Save results
            self._save_validation_result(vuln, result)
            
            # 7. Update Vulnerability status
            if result.get('validated'):
                vuln.validation_status = 'verified'
                vuln.validation_confidence = result.get('confidence', 1.0)
            else:
                vuln.validation_status = 'not_working'
                vuln.validation_confidence = 0.0
            
            vuln.save()
            
        except Exception as e:
            logger.error(f"Error during validation of {vuln.id}: {str(e)}")
            self.policy_engine.record_execution(finding.url, False)

    def _save_validation_result(self, vuln: Vulnerability, result: dict):
        """
        Persists validation outcome to the database.
        """
        ValidationResult.objects.create(
            vulnerability=vuln,
            tool=result.get('tool', 'ERL_Adapter'),
            validated=result.get('validated', False),
            confidence=result.get('confidence', 0.0),
            payload=result.get('payload', ''),
            request_evidence=result.get('request_evidence', ''),
            response_evidence=result.get('response_evidence', ''),
            timestamp=timezone.now()
        )
