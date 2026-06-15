from .vuln_evaluator import VulnEvaluator
from .header_evaluator import HeaderEvaluator
from .port_evaluator import PortEvaluator
from .dns_evaluator import DNSEvaluator

EVALUATOR_MAP = {
    'vuln': VulnEvaluator,
    'header': HeaderEvaluator,
    'port': PortEvaluator,
    'dns': DNSEvaluator,
}
