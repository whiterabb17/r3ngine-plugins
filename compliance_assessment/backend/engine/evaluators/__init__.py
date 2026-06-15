from .vuln_evaluator import VulnEvaluator
from .base import EvaluatorResult


class HeaderEvaluator:
    def check(self, scan_id, params):
        return EvaluatorResult(matches=False, confidence='MEDIUM', evidence=[])

class PortEvaluator:
    def check(self, scan_id, params):
        return EvaluatorResult(matches=False, confidence='MEDIUM', evidence=[])

class DNSEvaluator:
    def check(self, scan_id, params):
        return EvaluatorResult(matches=False, confidence='MEDIUM', evidence=[])

EVALUATOR_MAP = {
    'vuln': VulnEvaluator,
    'header': HeaderEvaluator,
    'port': PortEvaluator,
    'dns': DNSEvaluator,
}
