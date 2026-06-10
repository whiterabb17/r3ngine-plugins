import os
import json
import asyncio
from datetime import datetime, timezone
from temporalio import activity, workflow
from asgiref.sync import sync_to_async

# Note: In a real r3ngine deployment, we would import from plugins_data.metasploit_integration.backend.models
# Since the python environment might evaluate this file in different contexts, we'll do dynamic imports or assume the Django app is loaded.

@activity.defn
async def generate_rc_script_activity(task_id: int) -> str:
    from plugins_data.metasploit_integration.backend.models import MetasploitTask
    
    @sync_to_async
    def get_task():
        return MetasploitTask.objects.get(id=task_id)
        
    task = await get_task()
    
    # Generate .rc content as a single string of commands separated by semicolon
    rc_lines = [
        f"use {task.module_name}",
        f"set RHOSTS {task.target}"
    ]
    
    if task.parameters:
        for k, v in task.parameters.items():
            rc_lines.append(f"set {k} {v}")
            
    rc_lines.append("run")
    rc_lines.append("exit")
    
    return "; ".join(rc_lines)

@activity.defn
async def run_msfconsole_activity(commands: str) -> str:
    import docker
    import asyncio

    def _run_docker():
        client = docker.from_env()
        try:
            container_logs = client.containers.run(
                "metasploitframework/metasploit-framework:latest",
                command=["./msfconsole", "-q", "-x", commands],
                network="r3ngine_r3ngine_network",
                labels={
                    'com.docker.compose.project': 'r3ngine',
                    'com.docker.compose.service': 'msf_console_worker'
                },
                remove=True,
                detach=False
            )
            return container_logs.decode('utf-8', errors='replace')
        except docker.errors.ContainerError as e:
            return e.stderr.decode('utf-8', errors='replace') if e.stderr else str(e)
        except Exception as e:
            return str(e)
            
    return await asyncio.to_thread(_run_docker)

@activity.defn
async def parse_and_save_findings_activity(task_id: int, raw_output: str):
    from plugins_data.metasploit_integration.backend.models import MetasploitTask, MetasploitFinding
    
    @sync_to_async
    def process_output():
        task = MetasploitTask.objects.get(id=task_id)
        task.raw_output = raw_output
        task.save()
        
        # Extremely basic mock parser: look for "Opened" or "Vulnerable" lines
        for line in raw_output.split("\n"):
            if "Opened" in line or "Vulnerable" in line or "[+]" in line:
                MetasploitFinding.objects.create(
                    task=task,
                    host=task.target,
                    finding_type="Module Result",
                    details=line.strip()
                )
    
    await process_output()

@activity.defn
async def finalize_task_activity(task_id: int, status: str, error_msg: str = ""):
    from plugins_data.metasploit_integration.backend.models import MetasploitTask
    
    @sync_to_async
    def finalize():
        task = MetasploitTask.objects.get(id=task_id)
        task.status = status
        task.completed_at = datetime.now(timezone.utc)
        task.error_message = error_msg
        task.save()
        
    await finalize()


@workflow.defn
class MetasploitTaskWorkflow:
    @workflow.run
    async def run(self, task_id: int):
        from temporalio import exceptions
        try:
            # 1. Generate script (commands string)
            commands = await workflow.execute_activity(
                generate_rc_script_activity,
                task_id,
                schedule_to_close_timeout=workflow.timedelta(seconds=10)
            )
            
            # 2. Run MSF Console
            raw_output = await workflow.execute_activity(
                run_msfconsole_activity,
                commands,
                schedule_to_close_timeout=workflow.timedelta(minutes=10)
            )
            
            # 3. Parse findings
            await workflow.execute_activity(
                parse_and_save_findings_activity,
                args=[task_id, raw_output],
                schedule_to_close_timeout=workflow.timedelta(minutes=2)
            )
            
            # 4. Finalize
            await workflow.execute_activity(
                finalize_task_activity,
                args=[task_id, "COMPLETED", ""],
                schedule_to_close_timeout=workflow.timedelta(seconds=10)
            )
            
        except exceptions.ActivityError as e:
            await workflow.execute_activity(
                finalize_task_activity,
                args=[task_id, "FAILED", str(e.cause)],
                schedule_to_close_timeout=workflow.timedelta(seconds=10)
            )
            raise e
