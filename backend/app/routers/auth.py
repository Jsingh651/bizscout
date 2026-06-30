# FILE: backend/app/routers/auth.py

from typing import Optional
import os
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User
from app.services.auth import (
    get_user_by_email, create_user, verify_password,
    create_access_token, decode_token, hash_password
)
from app.limiter import limiter
from app.dependencies import get_current_user
import re

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    invite_code: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    class Config:
        from_attributes = True


class LoginRegisterResponse(BaseModel):
    user: UserResponse
    access_token: str


def validate_password(password: str):
    errors = []
    if len(password) < 8:
        errors.append("At least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("One uppercase letter")
    if not re.search(r"[0-9]", password):
        errors.append("One number")
    return errors


@router.post("/register", response_model=LoginRegisterResponse)
@limiter.limit("10/minute")
def register(request: Request, body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    required_code = os.getenv("REGISTRATION_CODE", "")
    if required_code and body.invite_code != required_code:
        raise HTTPException(status_code=403, detail="Invalid invite code")
    errors = validate_password(body.password)
    if errors:
        raise HTTPException(status_code=400, detail=", ".join(errors))
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(db, body.email, body.password, body.full_name)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    secure = os.getenv("ENVIRONMENT", "development") == "production"
    response.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=secure, samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"user": user, "access_token": token}


@router.post("/login", response_model=LoginRegisterResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    secure = os.getenv("ENVIRONMENT", "development") == "production"
    response.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=secure, samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"user": user, "access_token": token}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


class MeResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    access_token: str

    class Config:
        from_attributes = True


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    # Auth is resolved by get_current_user, which accepts both the
    # Authorization: Bearer header and the access_token cookie. This matters
    # in cross-site deploys (e.g. Vercel frontend + Railway API) where the
    # SameSite=Lax cookie is not sent and only the Bearer header is available.
    new_token = create_access_token({"sub": str(current_user.id), "email": current_user.email})
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "access_token": new_token,
    }


@router.put("/me", response_model=UserResponse)
def update_me(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = current_user

    # Update name
    if body.full_name is not None:
        stripped = body.full_name.strip()
        if len(stripped) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        user.full_name = stripped

    # Update password
    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        errors = validate_password(body.new_password)
        if errors:
            raise HTTPException(status_code=400, detail=", ".join(errors))
        user.hashed_password = hash_password(body.new_password)

    db.commit()
    db.refresh(user)
    return user