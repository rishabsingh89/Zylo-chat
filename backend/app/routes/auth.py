from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import random
import string
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse
from app.utils.security import hash_password, verify_password
from app.utils.auth import create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    trimmed_email = payload.email.strip().lower()
    trimmed_username = payload.username.strip()
    trimmed_name = (payload.name or "").strip() or trimmed_username

    try:
        # Check duplicate email (case-insensitive)
        existing_email = db.query(User).filter(func.lower(User.email) == trimmed_email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Check duplicate username
        existing_user = db.query(User).filter(func.lower(User.username) == trimmed_username.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

        user = User(
            name=trimmed_name,
            username=trimmed_username,
            email=trimmed_email,
            password_hash=hash_password(payload.password),
            is_online=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except HTTPException:
        # Re-raise standard HTTPExceptions (like duplicate conflicts) directly
        raise
    except IntegrityError as ie:
        db.rollback()
        err_str = str(ie).lower()
        if "email" in err_str:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        elif "username" in err_str:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or Email already registered")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Registration exception: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration error: {str(e)}"
        )

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    from sqlalchemy import or_
    identifier = payload.email.strip().lower()
    user = db.query(User).filter(
        or_(
            User.email.ilike(identifier),
            User.username.ilike(identifier)
        )
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No account found with this username/email. Please register first."
        )


    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Please try again."
        )

    user.is_online = True
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    import os
    trimmed_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(trimmed_email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address."
        )

    # Generate 6-digit OTP code
    otp = "".join(random.choices(string.digits, k=6))
    user.reset_otp = otp
    user.reset_otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    # Clear print for developer/logs console
    print(f"\n[OTP RESET] HEY! The OTP code for {trimmed_email} is: {otp}\n")

    # Try SMTP sending if configured, or just fallback silently
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = os.getenv("SMTP_PORT")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        
        if smtp_host and smtp_port and smtp_user and smtp_password:
            msg = MIMEText(f"Your Zylo Chat password reset OTP is: {otp}\nExpires in 10 minutes.")
            msg["Subject"] = "Zylo Chat Password Reset OTP"
            msg["From"] = smtp_user
            msg["To"] = trimmed_email
            
            with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
    except Exception as err:
        print(f"[Email Reset Error] Failed to send SMTP mail: {err}")

    return {"message": "OTP has been generated and printed/sent successfully."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    trimmed_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(trimmed_email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address."
        )

    if not user.reset_otp or user.reset_otp != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP code. Please check and try again."
        )

    if not user.reset_otp_expiry or user.reset_otp_expiry < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new one."
        )

    # Update password
    user.password_hash = hash_password(payload.new_password)
    user.reset_otp = None
    user.reset_otp_expiry = None
    db.commit()

    return {"message": "Password has been reset successfully."}
