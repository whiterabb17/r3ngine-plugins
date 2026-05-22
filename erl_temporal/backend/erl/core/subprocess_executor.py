import subprocess
import logging
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)

class SubprocessExecutor:
    """
    Manages local execution of tools via subprocess.
    """
    
    def __init__(self):
        pass

    def run_tool(self, 
                 command: str, 
                 cwd: Optional[str] = None,
                 environment: Optional[Dict[str, str]] = None,
                 timeout: int = 300) -> (int, str):
        """
        Runs a tool locally.
        """
        logger.info(f"Executing: {command}")
        
        try:
            # Merge with existing environment
            env = os.environ.copy()
            if environment:
                env.update(environment)
                
            # Run command
            process = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return process.returncode, process.stdout + "\n" + process.stderr

        except subprocess.TimeoutExpired as e:
            logger.error(f"Command timed out after {timeout}s: {command}")
            output = (e.stdout.decode('utf-8') if e.stdout else "") + \
                     "\n[TIMEOUT]\n" + \
                     (e.stderr.decode('utf-8') if e.stderr else "")
            return 124, output # 124 is standard timeout exit code
            
        except Exception as e:
            logger.error(f"Error executing command: {str(e)}")
            return 1, f"Execution error: {str(e)}"
