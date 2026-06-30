from fastapi import Depends, HTTPException, Cookie, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.services.auth import decode_token


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    """
    Shared auth dependency. Tries token sources in this order:
    1. Authorization: Bearer <token> header (most reliable)
    2. access_token httpOnly cookie
    """
    token = None

    # 1. Bearer header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    # 2. Cookie fallback
    if not token and access_token:
        token = access_token

    # 3. Raw header fallback (handles edge cases)
    if not token:
        raw = request.headers.get("authorization", "")
        if raw.startswith("Bearer "):
            token = raw[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Bind this DB session to the user so Postgres row-level-security policies
    # (see _setup_row_level_security) resolve to their rows. Session-scoped so it
    # survives commits within a request. No-op / harmless on SQLite.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        try:
            db.execute(text("SELECT set_config('app.current_user_id', :uid, false)"),
                       {"uid": str(user.id)})
        except Exception:
            pass

    return user