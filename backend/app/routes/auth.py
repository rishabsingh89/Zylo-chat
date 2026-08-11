from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

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

    # Check duplicate email (case-insensitive)
    existing_email = db.query(User).filter(func.lower(User.email) == trimmed_email).first()
    if existing_email:
        if existing_email.password_hash == "pending_invite_account":
            existing_email.username = trimmed_username
            existing_email.password_hash = hash_password(payload.password)
            existing_email.is_online = True
            db.commit()
            db.refresh(existing_email)
            access_token = create_access_token(data={"sub": existing_email.id})
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": existing_email
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered. Please sign in."
            )

    # Check duplicate username
    existing_user = db.query(User).filter(func.lower(User.username) == trimmed_username.lower()).first()
    if existing_user:
        if existing_user.password_hash == "pending_invite_account":
            existing_user.email = trimmed_email
            existing_user.password_hash = hash_password(payload.password)
            existing_user.is_online = True
            db.commit()
            db.refresh(existing_user)
            access_token = create_access_token(data={"sub": existing_user.id})
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": existing_user
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken. Please choose another."
            )

    user = User(
        username=trimmed_username,
        email=trimmed_email,
        password_hash=hash_password(payload.password),
        is_online=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

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
