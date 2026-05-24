# r3ngine-plugins/active_directory/backend/consumers.py
import asyncio
import json
import logging

import redis
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger(__name__)

WEBSOCKET_URLPATTERNS = [
    (r'ws/ad/assessment/(?P<assessment_id>\d+)/$', 'ADAssessmentConsumer'),
]


class ADAssessmentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.assessment_id = self.scope['url_route']['kwargs']['assessment_id']
        self.stream_key = f"ad:assessment:{self.assessment_id}"
        self.group_name = f"ad_assessment_{self.assessment_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"AD WebSocket connected for assessment {self.assessment_id}")

        self.keep_running = True
        self.tail_task = asyncio.create_task(self._tail_redis_stream())

    async def disconnect(self, close_code):
        self.keep_running = False
        if hasattr(self, 'tail_task'):
            self.tail_task.cancel()
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"AD WebSocket disconnected for assessment {self.assessment_id}")

    async def _tail_redis_stream(self):
        r = redis.StrictRedis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True,
        )
        last_id = '0'
        loop = asyncio.get_running_loop()

        while self.keep_running:
            try:
                streams = await loop.run_in_executor(
                    None,
                    lambda: r.xread({self.stream_key: last_id}, count=20, block=2000),
                )
                if streams:
                    for _stream_name, messages in streams:
                        for msg_id, data in messages:
                            last_id = msg_id
                            payload = json.loads(data['data'])
                            await self.send(text_data=json.dumps(payload))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"AD stream tail error: {e}")
                await asyncio.sleep(1)

    async def ad_assessment_update(self, event):
        """Receive direct channel-layer push (used for cancellations etc.)."""
        await self.send(text_data=json.dumps(event['data']))
