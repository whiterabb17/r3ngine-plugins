import base64
from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet

def get_fernet():
    # Generate a deterministic Fernet key using the Django SECRET_KEY
    key = settings.SECRET_KEY.encode('utf-8')
    key = key[:32].ljust(32, b'0')
    return Fernet(base64.urlsafe_b64encode(key))

class EncryptedCharField(models.CharField):
    description = "A CharField that automatically encrypts data at rest"

    def get_db_prep_value(self, value, connection, prepared=False):
        value = super().get_db_prep_value(value, connection, prepared)
        if value is not None and value != '':
            try:
                f = get_fernet()
                return f.encrypt(value.encode('utf-8')).decode('utf-8')
            except Exception:
                pass
        return value

    def from_db_value(self, value, expression, connection):
        if value is not None and value != '':
            try:
                f = get_fernet()
                return f.decrypt(value.encode('utf-8')).decode('utf-8')
            except Exception:
                # If decryption fails (e.g. data was unencrypted), return original
                return value
        return value

    def to_python(self, value):
        return value
