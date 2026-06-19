import logging
import os
import subprocess
import shlex
from reNgine.utils.opsec import OpSecManager, ProxychainsWrapper
from reNgine.utils.task import run_command

class CredentialOpSecManager:
    """
    Plugin-specific OpSec manager for credential intelligence tools 
    (brutus, netexec, kerbrute, hashcat).
    """
    def __init__(self):
        self.opsec = OpSecManager()
        self.proxy_manager = ProxychainsWrapper()
        self.logger = logging.getLogger(__name__)

    def execute_with_opsec(self, tool_name, command):
        """
        Applies stealth flags to a command, wraps it in proxychains if needed,
        executes the command, and cleans up temp config files.
        """
        # 1. Apply tool-specific stealth flags
        # If command is a string (legacy), convert it to a list
        if isinstance(command, str):
            stealth_cmd = shlex.split(command)
        else:
            stealth_cmd = list(command)

        if self.opsec.is_enabled():
            if tool_name == "brutus":
                stealth_cmd = self._apply_brutus(stealth_cmd)
            elif tool_name == "netexec":
                stealth_cmd = self._apply_netexec(stealth_cmd)
            elif tool_name == "kerbrute":
                stealth_cmd = self._apply_kerbrute(stealth_cmd)
            elif tool_name == "hashcat":
                stealth_cmd = self._apply_hashcat(stealth_cmd)

        # 2. Apply Proxychains if needed (Hashcat runs locally, so no proxy for it)
        conf_path = None
        if tool_name != "hashcat":
            proxy = self.proxy_manager.get_random_proxy()
            if proxy and self.proxy_manager.should_wrap():
                conf_path = self.proxy_manager.write_temp_config(proxy)
                from reNgine.definitions import PROXYCHAINS_EXEC_PATH
                stealth_cmd = [PROXYCHAINS_EXEC_PATH, "-f", conf_path] + stealth_cmd

        self.logger.info(f"Executing [{tool_name}] with opsec: {' '.join(stealth_cmd)}")
        
        # 3. Execute process
        try:
            returncode, output = run_command(stealth_cmd, timeout=3600)
            return {
                "stdout": output,
                "stderr": "",
                "returncode": returncode
            }
        except Exception as e:
            self.logger.error(f"Execution failed for {tool_name}: {str(e)}")
            return {
                "stdout": "",
                "stderr": str(e),
                "returncode": -1
            }
        finally:
            if conf_path and os.path.exists(conf_path):
                os.remove(conf_path)

    def _apply_brutus(self, cmd_list):
        if "-t" not in cmd_list and self.opsec.settings.enable_rate_limit:
            cmd_list.extend(["-t", str(self.opsec.settings.max_rps)])
        return cmd_list

    def _apply_netexec(self, cmd_list):
        if self.opsec.settings.enable_rate_limit:
            if "--threads" not in cmd_list:
                cmd_list.extend(["--threads", str(max(1, self.opsec.settings.max_rps // 2))])
        return cmd_list

    def _apply_kerbrute(self, cmd_list):
        if self.opsec.settings.enable_rate_limit:
            if "--delay" not in cmd_list:
                delay = int(1000 / self.opsec.settings.max_rps) if self.opsec.settings.max_rps > 0 else 0
                if delay > 0:
                    cmd_list.extend(["--delay", str(delay)])
        return cmd_list

    def _apply_hashcat(self, cmd_list):
        if self.opsec.settings.enable_rate_limit:
            if "-w" not in cmd_list:
                cmd_list.extend(["-w", "1"])
        return cmd_list
