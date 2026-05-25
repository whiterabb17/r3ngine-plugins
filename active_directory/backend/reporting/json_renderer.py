# r3ngine-plugins/active_directory/backend/reporting/json_renderer.py
import json
from datetime import datetime, date


class _ISOEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class JSONRenderer:
    @staticmethod
    def render(report: dict) -> bytes:
        return json.dumps(report, cls=_ISOEncoder, indent=2, ensure_ascii=False).encode('utf-8')
