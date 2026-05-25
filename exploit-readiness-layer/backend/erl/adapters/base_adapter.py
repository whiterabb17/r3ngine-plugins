import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from ..core.normalizer import Finding
from ..core.subprocess_executor import SubprocessExecutor
from reNgine.utils.opsec import ProxychainsWrapper, OpSecManager

class BaseAdapter(ABC):
    """
    Base class for all ERL tool adapters.
    """
    
    def __init__(self, executor: SubprocessExecutor):
        self.executor = executor
        self.binary = ""
        self.proxy_manager = ProxychainsWrapper()
        self.opsec_manager = OpSecManager()

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

    def _run_in_sandbox(self, command: str, use_proxychains: bool = True, **kwargs) -> (int, str):
        full_command = f"{self.binary} {command}"
        env = kwargs.pop('environment', {})
        
        conf_path = None
        if use_proxychains and self.proxy_manager.should_wrap():
            full_command, conf_path = self.proxy_manager.wrap_command(full_command)
        elif self.proxy_manager.proxies:
            # Inject environment variables for tools that respect them
            proxy_str = self.proxy_manager.get_random_proxy()
            parts = proxy_str.split()
            if len(parts) >= 3:
                proto, host, port = parts[0], parts[1], parts[2]
                # Map 'http' or 'https' to 'http' for the proxy URL
                p_proto = 'http' if proto in ['http', 'https'] else proto
                proxy_url = f"{p_proto}://{host}:{port}"
                env['HTTP_PROXY'] = proxy_url
                env['HTTPS_PROXY'] = proxy_url
                env['http_proxy'] = proxy_url
                env['https_proxy'] = proxy_url
            
        try:
            return self.executor.run_tool(
                command=full_command,
                environment=env,
                **kwargs
            )
        finally:
            if conf_path and os.path.exists(conf_path):
                try:
                    os.remove(conf_path)
                except Exception:
                    pass
