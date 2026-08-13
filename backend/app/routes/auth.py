from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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


def send_otp_email(trimmed_email: str, otp: str, smtp_host: str, smtp_port: str, smtp_user: str, smtp_password: str, smtp_sender: str):
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.utils import formataddr
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Zylo Chat Password Reset OTP"
        if smtp_sender:
            msg["From"] = formataddr(("Zylo Chat", smtp_sender))
        else:
            msg["From"] = "Zylo Chat <noreply@zylochat.com>"
        msg["To"] = trimmed_email
        
        text_body = f"Your Zylo Chat password reset OTP is: {otp}\n\nExpires in 10 minutes. If you did not request this, please ignore this email."
        
        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f6f9;
      color: #333333;
      margin: 0;
      padding: 0;
    }}
    .container {{
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      overflow: hidden;
      border: 1px solid #e1e8ed;
    }}
    .header {{
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      padding: 30px 20px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }}
    .content {{
      padding: 40px 30px;
      line-height: 1.6;
    }}
    .otp-container {{
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
      border: 1px dashed #d1d5db;
    }}
    .otp-code {{
      font-size: 36px;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: 6px;
      margin: 0;
    }}
    .footer {{
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #f3f4f6;
    }}
    .warning {{
      font-size: 13px;
      color: #ef4444;
      margin-top: 20px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Zylo Chat</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset the password for your Zylo Chat account. Use the 6-digit verification code below to proceed:</p>
      <div class="otp-container">
        <h2 class="otp-code">{otp}</h2>
      </div>
      <p>This verification code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email or secure your account.</p>
      <p class="warning">Do not share this OTP with anyone for security reasons.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 Zylo Chat. All rights reserved.</p>
    </div>
  </div>
</body>
</html>"""

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            if smtp_host not in ["localhost", "127.0.0.1"]:
                try:
                    server.starttls()
                except Exception as tls_err:
                    print(f"[Email Reset] STARTTLS failed: {tls_err}")
        
        if smtp_user and smtp_password and smtp_host not in ["localhost", "127.0.0.1"]:
            server.login(smtp_user, smtp_password)
            
        server.send_message(msg)
        server.quit()
        print(f"[Email Reset] Successfully sent password reset email via SMTP to {trimmed_email}")
    except Exception as err:
        import traceback
        traceback.print_exc()
        print(f"[Email Reset Error] Failed to send SMTP mail: {err}")


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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

    # Queue SMTP sending as background task
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_sender = os.getenv("SMTP_SENDER") or smtp_user
    
    if smtp_host and smtp_port:
        background_tasks.add_task(
            send_otp_email,
            trimmed_email,
            otp,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_password,
            smtp_sender
        )

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
