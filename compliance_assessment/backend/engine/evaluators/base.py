from dataclasses import dataclass, field


@dataclass
class EvaluatorResult:
    matches: bool
    confidence: str  # HIGH | MEDIUM | LOW
    evidence: list = field(default_factory=list)


class BaseEvaluator:
    def check(self, scan_id: int, params: dict) -> EvaluatorResult:
        raise NotImplementedError
