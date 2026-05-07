import docker
import logging
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)

class DockerManager:
    """
    Manages isolated Docker containers for tool execution.
    """
    
    def __init__(self):
        try:
            self.client = docker.from_env()
        except Exception as e:
            logger.error(f"Failed to connect to Docker daemon: {str(e)}")
            self.client = None

    def run_tool(self, 
                 image: str, 
                 command: str, 
                 volumes: Optional[Dict[str, Dict[str, str]]] = None,
                 environment: Optional[Dict[str, str]] = None,
                 cpu_quota: int = 50000, 
                 mem_limit: str = "256m",
                 timeout: int = 300) -> (int, str):
        """
        Runs a tool in a sandboxed container.
        """
        if not self.client:
            return 1, "Docker client not initialized."

        container = None
        try:
            # Create and start container
            container = self.client.containers.run(
                image=image,
                command=command,
                volumes=volumes,
                environment=environment,
                cpu_period=100000,
                cpu_quota=cpu_quota,
                mem_limit=mem_limit,
                network_mode="bridge",  # TODO: Implement stricter network isolation
                detach=True,
                remove=False # We want to get logs before removing
            )
            
            # Wait for completion
            result = container.wait(timeout=timeout)
            exit_code = result.get('StatusCode', 1)
            logs = container.logs().decode('utf-8')
            
            return exit_code, logs

        except Exception as e:
            logger.error(f"Error running container {image}: {str(e)}")
            return 1, f"Execution error: {str(e)}"
            
        finally:
            if container:
                try:
                    container.remove(force=True)
                except:
                    pass

    def pull_image(self, image: str):
        """
        Ensures the required image is available.
        """
        if not self.client:
            return
        try:
            self.client.images.pull(image)
            logger.info(f"Pulled image {image}")
        except Exception as e:
            logger.error(f"Failed to pull image {image}: {str(e)}")
