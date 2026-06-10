from django.urls import re_path
try:
    from plugins_data.metasploit_integration.backend.consumers import MetasploitTerminalConsumer
except ImportError:
    from .consumers import MetasploitTerminalConsumer

websocket_urlpatterns = [
    re_path(r'ws/plugins/metasploit_integration/terminal/$', MetasploitTerminalConsumer.as_asgi()),
]
