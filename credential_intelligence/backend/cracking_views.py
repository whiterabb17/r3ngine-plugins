import os
import re
import shlex
import socket
import logging
import docker
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from api.permissions import IsPenetrationTester, IsAuditor
from .models import HashCrackingTask, CrackedHash
from .serializers import HashCrackingTaskSerializer, CrackedHashSerializer

logger = logging.getLogger(__name__)

class HashCrackingTaskViewSet(viewsets.ModelViewSet):
    queryset = HashCrackingTask.objects.all().order_by('-created_at')
    serializer_class = HashCrackingTaskSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'execute', 'cancel']:
            return [IsAuthenticated(), IsPenetrationTester()]
        # Reading status or list of tasks is allowed for Auditors as well
        return [IsAuthenticated(), IsAuditor()]

    def _get_docker_client(self):
        try:
            return docker.from_env()
        except Exception as e:
            logger.error(f"[HashCracking] Failed to initialize Docker client: {e}")
            return None

    def _discover_wordlist_volume(self, client):
        """
        Dynamically query the Docker mounts of the current running container
        to find the named volume corresponding to /usr/src/wordlist.
        """
        try:
            hostname = socket.gethostname()
            container = client.containers.get(hostname)
            for mount in container.attrs.get('Mounts', []):
                if mount.get('Destination') == '/usr/src/wordlist':
                    return mount.get('Name') or mount.get('Source')
        except Exception as e:
            logger.warning(f"[HashCracking] Could not dynamically inspect container mounts: {e}")
        
        # Fallback to checking volume list
        try:
            volumes = [v.name for v in client.volumes.list()]
            return next((v for v in volumes if 'wordlist' in v), 'r3ngine_wordlist')
        except Exception:
            return 'r3ngine_wordlist'

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        task = self.get_object()
        if task.status in ['running', 'completed']:
            return Response({'error': 'Task is already running or completed'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Prevent DoS: check if another cracking container is currently running
        client = self._get_docker_client()
        if not client:
            return Response({'error': 'Docker socket is not available on host'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        running_tasks = HashCrackingTask.objects.filter(status='running')
        for rt in running_tasks:
            try:
                container = client.containers.get(rt.container_id)
                if container.status == 'running':
                    return Response({
                        'error': f'Another hash cracking task ({rt.name}) is currently running. Please wait for it to finish.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except docker.errors.NotFound:
                # Task container died or was removed, update status to failed
                rt.status = 'failed'
                rt.error_log = "Container not found. Process killed externally."
                rt.save()
            except Exception:
                pass

        # 2. Write hashes to a temporary path in /usr/src/wordlist
        hashes_dir = '/usr/src/wordlist/cracking_hashes'
        if not os.path.exists(hashes_dir):
            try:
                os.makedirs(hashes_dir)
            except Exception as e:
                return Response({'error': f'Failed to create directory in wordlist volume: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        hash_file_path = os.path.join(hashes_dir, f'task_{task.id}.txt')
        with open(hash_file_path, 'w') as f:
            f.write(task.hashes_txt.replace('\r\n', '\n'))

        # 3. Construct Hashcat command-line parameters
        # Output format: 3 (hash:plaintext)
        outfile_path = f'/usr/src/wordlist/cracking_hashes/cracked_{task.id}.txt'
        cmd = [
            'hashcat',
            '-m', str(task.hash_type),
            '-a', str(task.attack_mode),
            '-w', str(task.workload_profile),
            '-o', outfile_path,
            '--outfile-format', '3'
        ]

        # Add optional options safely
        if task.optimized_kernels:
            cmd.append('-O')
        if task.enable_username:
            cmd.append('--username')
        if task.force:
            cmd.append('--force')

        # Add custom charsets
        if task.custom_charset1:
            cmd.extend(['-1', task.custom_charset1])
        if task.custom_charset2:
            cmd.extend(['-2', task.custom_charset2])
        if task.custom_charset3:
            cmd.extend(['-3', task.custom_charset3])
        if task.custom_charset4:
            cmd.extend(['-4', task.custom_charset4])

        # Add increment mode
        if task.increment:
            cmd.append('--increment')
            cmd.extend(['--increment-min', str(task.increment_min)])
            cmd.extend(['--increment-max', str(task.increment_max)])

        # Rules
        if task.custom_rules:
            # Strip traversal characters to prevent path traversal vulnerability
            safe_rules = re.sub(r'[^a-zA-Z0-9_\-\.]', '', task.custom_rules)
            rules_path = f'/usr/src/wordlist/{safe_rules}'
            cmd.extend(['-r', rules_path])

        # Target hash file inside container mount
        cmd.append(f'/usr/src/wordlist/cracking_hashes/task_{task.id}.txt')

        # Mode dependent inputs: Mask vs Wordlist
        if task.attack_mode == 3: # Mask attack
            if not task.mask:
                return Response({'error': 'Mask parameter is required for attack mode 3'}, status=status.HTTP_400_BAD_REQUEST)
            # Basic validation of mask input (alphanumeric, question marks, custom placeholders)
            if not re.match(r'^[a-zA-Z0-9?_\-]+$', task.mask):
                return Response({'error': 'Invalid mask characters detected'}, status=status.HTTP_400_BAD_REQUEST)
            cmd.append(task.mask)
        else: # Wordlist attack
            if not task.wordlist:
                return Response({'error': 'Wordlist is required for this attack mode'}, status=status.HTTP_400_BAD_REQUEST)
            safe_wl = re.sub(r'[^a-zA-Z0-9_\-\.]', '', task.wordlist)
            wl_path = f'/usr/src/wordlist/{safe_wl}.txt'
            cmd.append(wl_path)

        # Add additional safe flags if specified
        if task.additional_flags:
            flags = shlex.split(task.additional_flags)
            # Sanity check on additional flags
            for f in flags:
                if any(c in f for c in [';', '&', '|', '$', '`', '>', '<']):
                    return Response({'error': 'Unsafe characters detected in additional flags'}, status=status.HTTP_400_BAD_REQUEST)
            cmd.extend(flags)

        # 4. Resolve Docker Volumes and start container
        wordlist_volume = self._discover_wordlist_volume(client)
        container_name = f'r3ngine_hashcat_task_{task.id}'
        
        # CPU and Memory resource constraints to prevent container takeover DoS
        run_kwargs = {
            'detach': True,
            'name': container_name,
            'volumes': {
                wordlist_volume: {'bind': '/usr/src/wordlist', 'mode': 'rw'}
            },
            'labels': {
                'com.docker.compose.project': 'r3ngine',
                'com.docker.compose.service': 'hashcat_cracking',
                'com.r3ngine.plugin.credential_intelligence.cracking': 'true'
            },
            'restart_policy': {'Name': 'no'},
            'mem_limit': '4g',
            'cpu_period': 100000,
            'cpu_quota': 200000 # Limit to 2 vCPUs max
        }

        # Attempt to run with NVIDIA GPUs if available
        try:
            device_requests = [
                docker.types.DeviceRequest(count=-1, capabilities=[['gpu']])
            ]
            # Try launching with GPU
            container = client.containers.run(
                'hashcat/hashcat:latest',
                cmd,
                device_requests=device_requests,
                **run_kwargs
            )
            task.gpu_status = 'NVIDIA GPU accelerated'
            logger.info(f"[HashCracking] Started Task {task.id} with GPU acceleration.")
        except Exception as e:
            logger.warning(f"[HashCracking] Failed to launch with GPU ({e}), falling back to CPU execution.")
            try:
                # Remove any failed/stopped container with the same name
                try:
                    c = client.containers.get(container_name)
                    c.remove(force=True)
                except Exception:
                    pass
                
                # Launch with CPU only
                container = client.containers.run(
                    'hashcat/hashcat:latest',
                    cmd,
                    **run_kwargs
                )
                task.gpu_status = 'CPU execution (no GPU drivers found)'
                logger.info(f"[HashCracking] Started Task {task.id} with CPU fallback.")
            except Exception as cpu_err:
                logger.error(f"[HashCracking] Failed to launch CPU fallback container: {cpu_err}")
                task.status = 'failed'
                task.error_log = f"Failed to start container: {cpu_err}"
                task.save()
                return Response({'error': f'Failed to launch container: {cpu_err}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Save active task status
        task.status = 'running'
        task.container_id = container.id
        task.save()

        return Response({
            'status': 'Cracking task launched',
            'gpu_status': task.gpu_status,
            'task_id': task.id
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.status != 'running':
            return Response({'error': 'Task is not running'}, status=status.HTTP_400_BAD_REQUEST)

        client = self._get_docker_client()
        if client and task.container_id:
            try:
                container = client.containers.get(task.container_id)
                container.kill()
                container.remove(force=True)
            except Exception as e:
                logger.warning(f"[HashCracking] Error killing container: {e}")

        task.status = 'failed'
        task.error_log = "Execution aborted by user."
        task.completed_at = timezone.now()
        task.save()

        return Response({'status': 'Task cancelled successfully'})

    @action(detail=True, methods=['get'])
    def status_info(self, request, pk=None):
        """
        Retrieves status of the task, reads the container logs/stdout,
        and parses cracked output file to populate results live.
        """
        task = self.get_object()
        client = self._get_docker_client()
        
        container_logs = ""
        exit_code = None

        if task.status == 'running' and client and task.container_id:
            try:
                container = client.containers.get(task.container_id)
                container_status = container.status
                exit_code = container.attrs.get('State', {}).get('ExitCode')

                # Fetch logs
                container_logs = container.logs(tail=100).decode('utf-8', errors='replace')

                if container_status == 'exited':
                    # Process final outputs
                    if exit_code in [0, 1]: # 0 = Completed/Passes, 1 = cracked
                        task.status = 'completed'
                    else:
                        task.status = 'failed'
                        task.error_log = f"Container exited with code {exit_code}. Logs:\n{container.logs().decode('utf-8')}"
                    
                    task.completed_at = timezone.now()
                    container.remove(force=True)
                    task.save()

            except docker.errors.NotFound:
                # Container is gone, finalize task
                task.status = 'failed'
                task.error_log = "Container terminated unexpectedly."
                task.completed_at = timezone.now()
                task.save()
            except Exception as e:
                logger.warning(f"[HashCracking] Error updating status from Docker: {e}")

        # Sync/Parse cracked hashes file
        cracked_file = f'/usr/src/wordlist/cracking_hashes/cracked_{task.id}.txt'
        if os.path.exists(cracked_file):
            try:
                new_cracked = []
                with open(cracked_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line or ':' not in line:
                            continue
                        
                        # hashcat format hash:plaintext
                        # Handle cases where hash contains colons (e.g. NTLM, NetNTLMv2)
                        parts = line.split(':')
                        plaintext = parts[-1]
                        raw_hash = ':'.join(parts[:-1])

                        # Ensure we don't save duplicates
                        if not CrackedHash.objects.filter(task=task, raw_hash=raw_hash).exists():
                            new_cracked.append(
                                CrackedHash(task=task, raw_hash=raw_hash, plaintext=plaintext)
                            )
                
                if new_cracked:
                    with transaction.atomic():
                        CrackedHash.objects.bulk_create(new_cracked)
            except Exception as parse_err:
                logger.error(f"[HashCracking] Error reading cracked output file: {parse_err}")

        # Build response payload
        serializer = self.get_serializer(task)
        data = serializer.data
        data['logs'] = container_logs or task.error_log
        
        # Include cracked count
        data['cracked_count'] = CrackedHash.objects.filter(task=task).count()

        return Response(data)

    @action(detail=True, methods=['get'])
    def cracked_hashes(self, request, pk=None):
        """
        Specific Auditor-friendly view to extract plaintext cracked results.
        Restricted to IsAuditor permission.
        """
        task = self.get_object()
        hashes = CrackedHash.objects.filter(task=task).order_by('-discovered_at')
        serializer = CrackedHashSerializer(hashes, many=True)
        return Response(serializer.data)
