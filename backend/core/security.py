import os
import hmac
import hashlib
import time
from typing import Optional, Dict, Any
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from backend.config import settings

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
        
        admin_token = os.environ.get("ADMIN_TOKEN")
        if not admin_token:
            raise ValueError("ADMIN_TOKEN environment variable is required. Generate one with: python -c 'import secrets; print(secrets.token_hex(32))'")
        if len(admin_token) < 32:
            raise ValueError("ADMIN_TOKEN must be at least 32 characters long.")
        # This token must be persistent across restarts to ensure admin signatures remain valid
        self._secrets['admin_token'] = admin_token

    def get_secret(self, key: str) -> str:
        return self._secrets.get(key, "")

    def rotate_secret(self, key: str, new_value: str):
        self._secrets[key] = new_value

secrets_manager = SecretsManager()

def verify_admin_signature(signature: str, payload: str, timestamp: str) -> bool:
    """Verifies HMAC signature for admin requests."""
    # To prevent replay attacks
    if abs(time.time() - float(timestamp)) > 300:
        return False
        
    secret = secrets_manager.get_secret('admin_token').encode()
    message = f"{payload}:{timestamp}".encode()
    expected_mac = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_mac, signature)

def generate_secure_hex(length: int = 6) -> str:
    """Replaces md5(random()) with a cryptographically secure hex generator."""
    return secrets.token_hex(length).upper()


security = HTTPBearer()

def verify_jwt(token: str) -> Dict[str, Any]:
    try:
        secret = settings.jwt_secret.get_secret_value()
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        
        exp = payload.get("exp")
        if exp and time.time() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    return verify_jwt(token)

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = current_user.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return current_user

