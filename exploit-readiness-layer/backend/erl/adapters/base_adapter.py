from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from ..core.normalizer import Finding
from ..sandbox.docker_manager import DockerManager

class BaseAdapter(ABC):
    """
    Base class for all ERL tool adapters.
    """
    
    def __init__(self, docker_manager: DockerManager):
        self.docker_manager = docker_manager
        self.image = ""

    @abstractmethod
    def validate(self, finding: Finding) -> Dict[str, Any]:
        """
        Executes validation for a finding.
        Returns a dict with:
        - validated: bool
        - confidence: float
        - payload: str
        - request_evidence: str
        - response_evidence: str
        - error: str (optional)
        """
        pass

    def _run_in_sandbox(self, command: str, **kwargs) -> (int, str):
        return self.docker_manager.run_tool(
            image=self.image,
            command=command,
            **kwargs
        )
