from typing import List, Dict, Any
from .normalizer import Finding

class ConfidenceEngine:
    """
    Computes confidence scores for findings to prioritize and validate.
    """
    
    def __init__(self):
        # Weights as defined in the spec
        self.weights = {
            'scanner_confidence': 0.4,
            'reflection_score': 0.2,
            'error_score': 0.2,
            'tech_match_score': 0.2
        }

    def calculate_initial_score(self, finding: Finding) -> float:
        """
        Calculates initial confidence before active validation.
        """
        scanner_score = finding.initial_confidence
        
        # Static checks
        reflection_score = self._check_reflection_potential(finding)
        error_score = self._check_error_potential(finding)
        tech_match_score = self._check_tech_match(finding)
        
        total_score = (
            scanner_score * self.weights['scanner_confidence'] +
            reflection_score * self.weights['reflection_score'] +
            error_score * self.weights['error_score'] +
            tech_match_score * self.weights['tech_match_score']
        )
        
        return round(total_score, 2)

    def _check_reflection_potential(self, finding: Finding) -> float:
        """
        Check if the vulnerability type has parameters that might reflect.
        """
        if finding.vuln_type == 'xss':
            # If we have parameters, it's more likely to reflect
            return 1.0 if finding.params else 0.5
        return 0.5

    def _check_error_potential(self, finding: Finding) -> float:
        """
        Check if we see error patterns in the original finding.
        """
        # For SQLi, if the name contains "error based", it's high potential
        if finding.vuln_type == 'sqli' and 'error' in finding.name.lower():
            return 1.0
        return 0.5

    def _check_tech_match(self, finding: Finding) -> float:
        """
        Check if the vulnerability matches detected technologies.
        """
        if not finding.raw_vulnerability or not finding.raw_vulnerability.endpoint:
            return 0.5
            
        endpoint = finding.raw_vulnerability.endpoint
        techs = [t.name.lower() for t in endpoint.techs.all()]
        
        vuln_name = finding.name.lower()
        
        # Example: PHP vulnerability on a PHP site
        if 'php' in vuln_name and 'php' in techs:
            return 1.0
        if 'sql' in vuln_name and any(db in techs for db in ['mysql', 'postgresql', 'sqlite', 'mssql', 'oracle']):
            return 1.0
            
        return 0.5

    def calculate_validation_score(self, validated: bool, tool_confidence: float) -> float:
        """
        Calculate final confidence after validation.
        """
        if not validated:
            return 0.0
        return tool_confidence
