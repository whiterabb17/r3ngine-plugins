import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
import logging

logger = logging.getLogger(__name__)

# Must match the container name used in views.py
MSF_CONTAINER_NAME = 'msf_console'


def _is_msf_running_sync() -> bool:
    """
    Synchronous check whether the named Metasploit console container is running.
    Used from the async consumer via asyncio.to_thread.
    """
    import docker
    try:
        client = docker.from_env()
        container = client.containers.get(MSF_CONTAINER_NAME)
        return container.status == 'running'
    except Exception as e:
        logger.error(f"[MSF WS] Error checking running status: {e}")
        return False


class MetasploitTerminalConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that provides a 2-way interactive PTY terminal
    attached to a running named Metasploit console container via Docker SDK.
    """

    async def connect(self):
        import docker
        logger.info("[MSF WS] New terminal connection requested")
        
        # 1. Authenticate
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            logger.warning("[MSF WS] Rejecting connection: User not authenticated")
            await self.close(code=4003)
            return

        # Simple RBAC: only staff/superusers can use the interactive terminal
        if not (user.is_staff or user.is_superuser):
            logger.warning("[MSF WS] Rejecting connection: Insufficient privileges")
            await self.close(code=4003)
            return

        await self.accept()
        logger.info("[MSF WS] Connection accepted")

        # 2. Check if a Metasploit container is already running
        is_running = await asyncio.to_thread(_is_msf_running_sync)
        if not is_running:
            logger.warning("[MSF WS] Rejecting connection: msf_console not running")
            await self.send(text_data=json.dumps({
                'action': 'no_instance',
                'message': 'No running Metasploit instance. Use the "Start Instance" button to launch one.'
            }))
            await self.close()
            return

        # 3. Create Exec Instance via APIClient
        def _attach_exec():
            logger.info("[MSF WS] Creating exec_start socket")
            client = docker.APIClient()
            exec_inst = client.exec_create(
                MSF_CONTAINER_NAME,
                cmd=['./msfconsole', '-q'],
                stdin=True,
                tty=True
            )
            # Returns a socket-like object
            sock = client.exec_start(exec_inst['Id'], socket=True, tty=True)
            # We want the underlying raw socket to read/write cleanly
            if hasattr(sock, '_sock'):
                raw_sock = sock._sock
            else:
                raw_sock = sock
            return client, exec_inst['Id'], raw_sock

        try:
            self.api_client, self.exec_id, self.sock = await asyncio.to_thread(_attach_exec)
            logger.info("[MSF WS] Socket attached successfully")
        except Exception as e:
            logger.error(f"[MSF WS] Error attaching to container: {str(e)}")
            await self.send(text_data=json.dumps({
                'action': 'output',
                'data': f"Error attaching to container: {str(e)}\r\n"
            }))
            await self.close()
            return

        # 4. Start Socket reader task
        logger.info("[MSF WS] Starting background reader task")
        self.read_task = asyncio.create_task(self._read_from_socket())

    async def disconnect(self, close_code):
        logger.info(f"[MSF WS] Disconnecting with code {close_code}")
        if hasattr(self, 'read_task'):
            self.read_task.cancel()
        if hasattr(self, 'sock'):
            try:
                self.sock.close()
            except Exception:
                pass

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'input' and hasattr(self, 'sock'):
                payload = data.get('data', '')
                def _write():
                    try:
                        self.sock.sendall(payload.encode('utf-8'))
                    except Exception:
                        pass
                await asyncio.to_thread(_write)

            elif action == 'resize' and hasattr(self, 'api_client') and hasattr(self, 'exec_id'):
                cols = data.get('cols', 80)
                rows = data.get('rows', 24)
                def _resize():
                    try:
                        self.api_client.exec_resize(self.exec_id, height=rows, width=cols)
                    except Exception:
                        pass
                await asyncio.to_thread(_resize)
        except Exception:
            pass

    async def _read_from_socket(self):
        try:
            while True:
                data = await asyncio.to_thread(self.sock.recv, 1024)
                if not data:
                    break
                await self.send(text_data=json.dumps({
                    'action': 'output',
                    'data': data.decode('utf-8', errors='replace')
                }))
        except Exception:
            pass  # Socket closed
        finally:
            await self.close()

WEBSOCKET_URLPATTERNS = [
    (r'^ws/plugins/metasploit_integration/terminal/$', 'MetasploitTerminalConsumer'),
]
