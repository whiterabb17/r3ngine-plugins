import json
import asyncio
import pty
import os
import fcntl
import termios
import struct
import select
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class MetasploitTerminalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. Authenticate connection
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4003)
            return

        # Simple RBAC check: Only staff/superusers can spawn interactive terminals
        if not (user.is_staff or user.is_superuser):
            await self.close(code=4003)
            return

        await self.accept()

        # 2. Spawn PTY and Docker process
        self.master_fd, self.slave_fd = pty.openpty()
        
        # We run the metasploit docker container
        # Note: In a production environment, you might use the docker python client.
        # Here we use subprocess mapped to the PTY.
        cmd = [
            'docker', 'run', '--rm', '-it',
            'metasploitframework/metasploit-framework:latest',
            'msfconsole'
        ]
        
        self.proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            close_fds=True,
            preexec_fn=os.setsid
        )
        
        os.close(self.slave_fd)
        
        # 3. Start task to read from PTY and send to WebSocket
        self.read_task = asyncio.create_task(self._read_from_pty())

    async def disconnect(self, close_code):
        if hasattr(self, 'read_task'):
            self.read_task.cancel()
        if hasattr(self, 'proc') and self.proc.returncode is None:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                self.proc.kill()
        if hasattr(self, 'master_fd'):
            try:
                os.close(self.master_fd)
            except OSError:
                pass

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                data = json.loads(text_data)
                action = data.get('action')
                
                if action == 'input':
                    # Write input to PTY
                    payload = data.get('data', '')
                    os.write(self.master_fd, payload.encode('utf-8'))
                
                elif action == 'resize':
                    # Handle terminal resize
                    cols = data.get('cols', 80)
                    rows = data.get('rows', 24)
                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                    fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except Exception as e:
                pass

    async def _read_from_pty(self):
        loop = asyncio.get_running_loop()
        try:
            while True:
                # Use select to wait for output from the PTY non-blockingly
                # Actually, in asyncio we can use add_reader
                future = loop.create_future()
                
                def callback():
                    if not future.done():
                        future.set_result(None)
                
                loop.add_reader(self.master_fd, callback)
                try:
                    await future
                finally:
                    loop.remove_reader(self.master_fd)
                
                output = os.read(self.master_fd, 1024)
                if not output:
                    break
                    
                await self.send(text_data=json.dumps({
                    'action': 'output',
                    'data': output.decode('utf-8', errors='replace')
                }))
        except OSError:
            pass # PTY closed
        finally:
            await self.close()
