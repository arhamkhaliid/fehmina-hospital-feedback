import hashlib
import hmac
import os
import secrets
import time
from app.config import SECRET_KEY

# In-memory active sessions: token -> {username, expires_at}
ACTIVE_SESSIONS = {}
SESSION_TTL = 3600 * 12  # 12 hours

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # PBKDF2 with 100,000 iterations of SHA-256
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex(), salt

def verify_password(stored_hash: str, salt: str, provided_password: str) -> bool:
    key = hashlib.pbkdf2_hmac(
        'sha256',
        provided_password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return hmac.compare_digest(stored_hash, key.hex())

def create_session(username: str) -> str:
    # Clean expired sessions
    now = time.time()
    expired = [t for t, data in ACTIVE_SESSIONS.items() if data['expires_at'] < now]
    for t in expired:
        ACTIVE_SESSIONS.pop(t, None)
    
    token = secrets.token_urlsafe(32)
    ACTIVE_SESSIONS[token] = {
        'username': username,
        'expires_at': now + SESSION_TTL
    }
    return token

def validate_session(token: str) -> bool:
    if not token:
        return False
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        return False
    if session['expires_at'] < time.time():
        ACTIVE_SESSIONS.pop(token, None)
        return False
    return True

def destroy_session(token: str) -> None:
    ACTIVE_SESSIONS.pop(token, None)
