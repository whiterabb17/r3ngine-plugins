import logging
from typing import List, Optional
from .normalizer import Normalizer, Finding
from .confidence_engine import ConfidenceEngine
from .policy_engine import PolicyEngine
from .subprocess_executor import SubprocessExecutor
from ..adapters.sqlmap_adapter import SqlmapAdapter
from ..adapters.xsstrike_adapter import XSStrikeAdapter
from startScan.models import Vulnerability, ValidationResult, ScanHistory
from django.utils import timezone
import yaml

logger = logging.getLogger(__name__)

class Orchestrator:
    """
    Main orchestrator for the Exploitation Readiness Layer (ERL).
    """
    
    def __init__(self):
        self.normalizer = Normalizer()
        self.confidence_engine = ConfidenceEngine()
        self.policy_engine = PolicyEngine()
        self.executor = SubprocessExecutor()
        
        # Initialize adapters
        self.adapters = {
            'sqli': SqlmapAdapter(self.executor),
            'xss': XSStrikeAdapter(self.executor),
        }
        self.run_sqlmap = True
        self.run_xsstrike = True
        self.confidence_threshold = 0.5

    def process_scan(self, scan_history_id: int):
        """
        Processes all unverified vulnerabilities for a given scan.
        """
        try:
            scan_history = ScanHistory.objects.get(id=scan_history_id)
            engine_config = yaml.safe_load(scan_history.scan_type.yaml_configuration)
            erl_config = engine_config.get('erl', {})
            
            if not erl_config.get('enabled', True):
                logger.info(f"ERL disabled by engine config for scan {scan_history_id}")
                return

            enabled_tools = erl_config.get('use_tool', ['sqlmap', 'XSStrike'])
            self.run_sqlmap = 'sqlmap' in enabled_tools
            self.run_xsstrike = 'XSStrike' in enabled_tools
            self.confidence_threshold = erl_config.get('confidence_threshold', 0.5)
            
        except Exception as e:
            logger.warning(f"Could not load engine config for scan {scan_history_id}, using defaults: {str(e)}")

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
        
        if initial_score < self.confidence_threshold:
            logger.info(f"Vulnerability {vuln.id} skipped: Initial confidence too low ({initial_score})")
            return

        # 3. Policy Check
        allowed, reason = self.policy_engine.is_allowed(finding)
        if not allowed:
            logger.warning(f"Vulnerability {vuln.id} blocked by policy: {reason}")
            return

        # 4. Select Adapter
        if finding.vuln_type == 'sqli' and not self.run_sqlmap:
            logger.info(f"Sqlmap disabled by engine config (Vulnerability {vuln.id})")
            return
        if finding.vuln_type == 'xss' and not self.run_xsstrike:
            logger.info(f"XSStrike disabled by engine config (Vulnerability {vuln.id})")
            return

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
