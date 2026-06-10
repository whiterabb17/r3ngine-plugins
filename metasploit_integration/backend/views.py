import logging
import docker
import threading
from datetime import datetime, timezone

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.core.cache import cache
from .models import MetasploitWorkspace, MetasploitTask, MetasploitFinding
from .serializers import MetasploitWorkspaceSerializer, MetasploitTaskSerializer, MetasploitFindingSerializer

logger = logging.getLogger(__name__)

# The well-known container name used for the interactive console session.
# This must match the --name used when starting the container.
MSF_CONTAINER_NAME = 'msf_console'
MSF_IMAGE = 'metasploitframework/metasploit-framework:latest'


def _get_docker_client():
    try:
        return docker.from_env()
    except Exception as e:
        logger.error(f"[MSF] Failed to initialize Docker client: {e}")
        return None


def _is_msf_running() -> bool:
    """Check if the Metasploit console container is currently running."""
    client = _get_docker_client()
    if not client:
        return False
    try:
        container = client.containers.get(MSF_CONTAINER_NAME)
        return container.status == 'running'
    except docker.errors.NotFound:
        return False
    except Exception as e:
        logger.warning(f"[MSF] Error checking container status: {e}")
        return False


def _is_image_present() -> bool:
    """Check if the Metasploit Docker image is already downloaded."""
    client = _get_docker_client()
    if not client:
        return False
    try:
        client.images.get(MSF_IMAGE)
        return True
    except docker.errors.ImageNotFound:
        return False
    except Exception as e:
        logger.warning(f"[MSF] Error checking image presence: {e}")
        return False


def _is_pulling() -> bool:
    """Check if the Metasploit Docker image is currently being pulled."""
    return cache.get('msf_pulling', False)


def _pull_image_background():
    """Pulls the Metasploit image in a background thread and updates the cache."""
    def _pull():
        client = _get_docker_client()
        if not client:
            cache.delete('msf_pulling')
            return
            
        try:
            logger.info(f"[MSF] Background pull starting for {MSF_IMAGE}")
            client.images.pull(MSF_IMAGE)
            logger.info(f"[MSF] Background pull complete for {MSF_IMAGE}")
        except Exception as e:
            logger.error(f"[MSF] Error pulling image: {e}")
        finally:
            cache.delete('msf_pulling')
            
    cache.set('msf_pulling', True, timeout=1800) # Max 30 min pulling timeout
    threading.Thread(target=_pull, daemon=True).start()


def _start_msf_container() -> bool:
    """
    Start the Metasploit console container in detached mode if not already running.
    Uses a named container so it can be attached to later.

    Returns True on success, False on failure.
    """
    client = _get_docker_client()
    if not client:
        return False
        
    try:
        # Remove any stopped container with the same name first
        try:
            old_container = client.containers.get(MSF_CONTAINER_NAME)
            old_container.remove(force=True)
        except docker.errors.NotFound:
            pass

        # Start a new detached container with interactive TTY allocated
        client.containers.run(
            MSF_IMAGE,
            command=['./msfconsole', '-q'],
            name=MSF_CONTAINER_NAME,
            network='r3ngine_r3ngine_network',
            labels={
                'com.docker.compose.project': 'r3ngine',
                'com.docker.compose.service': 'msf_console'
            },
            detach=True,
            remove=True,
            tty=True,
            stdin_open=True
        )
        
        logger.info(f"[MSF] Container started: {MSF_CONTAINER_NAME}")
        return True
    except Exception as e:
        logger.error(f"[MSF] Exception starting container: {e}")
        return False


# RBAC: Custom permission class restricting access to staff/superusers (or pentesters)
class IsPentesterOrAdmin(permissions.BasePermission):
    """
    Only authenticated staff/superusers (pentesters/admins) can access Metasploit APIs.
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


class MetasploitWorkspaceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Metasploit workspaces."""
    queryset = MetasploitWorkspace.objects.all().order_by('-created_at')
    serializer_class = MetasploitWorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]


class MetasploitTaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing automated Metasploit tasks (Temporal-driven scans).
    On task creation, checks for a running console instance and starts one if absent,
    then triggers the Temporal workflow.
    """
    queryset = MetasploitTask.objects.all().order_by('-id')
    serializer_class = MetasploitTaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]

    @action(detail=False, methods=['get'], url_path='console-status')
    def console_status(self, request):
        """
        GET /api/plugins/metasploit_integration/tasks/console-status/
        Returns whether the named Metasploit console container is currently running,
        and whether the image is present or currently being pulled.
        """
        running = _is_msf_running()
        present = _is_image_present()
        pulling = _is_pulling() if not present else False
        return Response({
            'running': running,
            'image_present': present,
            'is_pulling': pulling,
            'container': MSF_CONTAINER_NAME
        })

    @action(detail=False, methods=['post'], url_path='console-start')
    def console_start(self, request):
        """
        POST /api/plugins/metasploit_integration/tasks/console-start/
        Starts the named Metasploit console container if not already running.
        If the image is missing, initiates a background pull.
        Only staff/superusers can call this endpoint.
        """
        if _is_msf_running():
            return Response({'started': False, 'running': True, 'container': MSF_CONTAINER_NAME})

        if not _is_image_present():
            if not _is_pulling():
                _pull_image_background()
            return Response({'started': False, 'running': False, 'pulling': True, 'container': MSF_CONTAINER_NAME})

        started = _start_msf_container()
        return Response(
            {'started': started, 'running': started, 'container': MSF_CONTAINER_NAME},
            status=status.HTTP_200_OK if started else status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    @action(detail=False, methods=['post'], url_path='console-stop')
    def console_stop(self, request):
        """
        POST /api/plugins/metasploit_integration/tasks/console-stop/
        Terminates the Metasploit console container.
        """
        client = _get_docker_client()
        if not client:
            return Response({'stopped': False, 'error': 'Docker socket not available'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        try:
            container = client.containers.get(MSF_CONTAINER_NAME)
            container.remove(force=True)
            logger.info(f"[MSF] Container forcibly removed: {MSF_CONTAINER_NAME}")
            return Response({'stopped': True})
        except docker.errors.NotFound:
            return Response({'stopped': True})
        except Exception as e:
            logger.error(f"[MSF] Exception stopping container: {e}")
            return Response({'stopped': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='console-modules')
    def console_modules(self, request):
        """
        GET /api/plugins/metasploit_integration/tasks/console-modules/
        Returns a list of available Metasploit modules by inspecting the container.
        """
        if not _is_msf_running():
            return Response({'modules': [], 'error': 'Container not running'}, status=status.HTTP_400_BAD_REQUEST)

        client = _get_docker_client()
        if not client:
            return Response({'modules': [], 'error': 'Docker client unavailable'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        try:
            container = client.containers.get(MSF_CONTAINER_NAME)
            
            # Use docker exec to find all .rb files in the modules directory
            exec_result = container.exec_run(
                ['find', '/usr/src/metasploit-framework/modules', '-type', 'f', '-name', '*.rb']
            )
            
            if exec_result.exit_code != 0:
                logger.error(f"[MSF] Failed to find modules: {exec_result.output.decode('utf-8', errors='ignore')}")
                return Response({'modules': []})

            output = exec_result.output.decode('utf-8', errors='ignore')
            modules = []
            for line in output.strip().split('\n'):
                line = line.strip()
                if not line:
                    continue
                
                # Convert path to module name
                # e.g., /usr/src/metasploit-framework/modules/exploits/windows/smb/ms17_010_eternalblue.rb
                # => exploits/windows/smb/ms17_010_eternalblue
                prefix = '/usr/src/metasploit-framework/modules/'
                if line.startswith(prefix):
                    mod_name = line[len(prefix):]
                    if mod_name.endswith('.rb'):
                        mod_name = mod_name[:-3]
                        modules.append(mod_name)

            return Response({'modules': sorted(modules)})
        except docker.errors.NotFound:
            return Response({'modules': [], 'error': 'Container not running'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"[MSF] Exception fetching modules: {e}")
            return Response({'modules': [], 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        """
        On task creation: ensure a running MSF instance exists first,
        then save and trigger the Temporal workflow.
        """
        # Ensure MSF instance is available before running automated tasks
        if not _is_msf_running():
            logger.info("[MSF] No running instance found — starting container for automated task.")
            if not _start_msf_container():
                from rest_framework.exceptions import APIException
                raise APIException("Failed to start Metasploit container. Check Docker availability.")

        task = serializer.save(started_at=datetime.now(timezone.utc), status='PENDING')

        # Trigger Temporal workflow
        try:
            from reNgine.tasks import TemporalClient
            import asyncio

            async def trigger_workflow():
                """Start the MetasploitTaskWorkflow for the given task."""
                client = await TemporalClient.get_client()
                await client.start_workflow(
                    "MetasploitTaskWorkflow",
                    task.id,
                    id=f"metasploit-task-{task.id}",
                    task_queue="r3ngine-plugin-tasks"
                )

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(trigger_workflow())
            loop.close()

        except Exception as e:
            task.status = 'FAILED'
            task.error_message = f"Failed to start workflow: {str(e)}"
            task.save()


class MetasploitFindingViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for Metasploit scan findings."""
    queryset = MetasploitFinding.objects.all().order_by('-created_at')
    serializer_class = MetasploitFindingSerializer
    permission_classes = [permissions.IsAuthenticated, IsPentesterOrAdmin]
