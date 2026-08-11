import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.database import get_db
from app.models.user import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "zylo_super_secret_jwt_key_production_grade_change_in_env")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 43200))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    # Handle mock token compatibility for seamless dev migration
    if token.startswith("bW9ja1_"):
        try:
            import base64
            decoded = base64.b64decode(token).decode("utf-8")
            parts = decoded.split("_")
            mock_id = f"mock_{parts[1]}" if len(parts) > 1 else token
            user = db.query(User).filter(User.id == mock_id).first()
            if not user:
                mock_username = f"user_{parts[1][:6]}" if len(parts) > 1 else "mock_user"
                mock_email = f"{mock_username}@zylo.com"
                user = User(
                    id=mock_id,
                    username=mock_username,
                    email=mock_email,
                    password_hash="mock_hash",
                    is_online=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user
        except Exception as mock_err:
            print(f"[Auth] Mock token handling error: {mock_err}")

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
