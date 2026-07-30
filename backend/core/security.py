import os
import hmac
import hashlib
import time
import secrets
import bcrypt

from fastapi import HTTPException, status

class SecretsManager:
    """Provides a centralized place to hold and rotate secrets if necessary."""
    def __init__(self):
        self._secrets = {}
        self.load_secrets()

    def load_secrets(self):
        # Fallback to os.environ but centralize here. A real version would fetch from AWS Secrets Manager / Vault.
        self._secrets['telegram_api_id'] = int(os.environ.get("TELEGRAM_API_ID", "0"))
        self._secrets['telegram_api_hash'] = os.environ.get("TELEGRAM_API_HASH", "")
        self._secrets['telegram_session'] = os.environ.get("PYROGRAM_SESSION_STRING", "")
        self._secrets['telegram_session_2'] = os.environ.get("PYROGRAM_SESSION_STRING_2", "")
        self._secrets['supabase_url'] = os.environ.get("SUPABASE_URL", "")
        self._secrets['supabase_service_key'] = os.environ.get("SUPABASE_SERVICE_KEY", "")
        self._secrets['supabase_anon_key'] = os.environ.get("SUPABASE_ANON_KEY", "")
        self._secrets['admin_token'] = os.environ.get("ADMIN_TOKEN", "")

    def get_secret(self, key: str) -> str:
        return self._secrets.get(key, "")

    def require_admin_token(self) -> str:
        admin_token = self.get_secret('admin_token') or os.environ.get("ADMIN_TOKEN", "")
        if not admin_token or len(admin_token) < 32:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ADMIN_TOKEN environment variable is required and must be at least 32 characters long."
            )
        return admin_token

    def rotate_secret(self, key: str, new_value: str):
        self._secrets[key] = new_value

secrets_manager = SecretsManager()

def verify_admin_signature(signature: str, payload: str, timestamp: str) -> bool:
    """Verifies HMAC signature for admin requests."""
    # TODO: There is no nonce, so replay attacks within the 60s window are still possible.
    try:
        ts = float(timestamp)
    except (ValueError, TypeError):
        return False

    if abs(time.time() - ts) > 60:
        return False
        
    secret = secrets_manager.require_admin_token().encode()
    message = f"{payload}:{timestamp}".encode()
    expected_mac = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_mac, signature)

def generate_secure_hex(length: int = 6) -> str:
    """Replaces md5(random()) with a cryptographically secure hex generator."""
    return secrets.token_hex(length).upper()

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))


