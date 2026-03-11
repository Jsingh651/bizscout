from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User
from app.services.auth import (
    get_user_by_email, create_user, verify_password,
    create_access_token, decode_token
)
import re

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]

    class Config:
        from_attributes = True

def validate_password(password: str):
    errors = []
    if len(password) < 8:
        errors.append("At least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("One uppercase letter")
    if not re.search(r"[0-9]", password):
        errors.append("One number")
    return errors

@router.post("/register", response_model=UserResponse)
def register(body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    errors = validate_password(body.password)
    if errors:
        raise HTTPException(status_code=400, detail=", ".join(errors))

    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(db, body.email, body.password, body.full_name)
    token = create_access_token({"sub": str(user.id), "email": user.email})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return user

@router.post("/login", response_model=UserResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return user

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}

@router.get("/me", response_model=UserResponse)
def me(access_token: Optional[str] = Cookie(default=None), db: Session = Depends(get_db)):
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user