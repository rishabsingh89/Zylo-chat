import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.utils.auth import get_current_user
from app.utils.security import validate_uploaded_file

from sqlalchemy import or_, func

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/search", response_model=List[UserResponse])
def search_users(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = q.strip().lower()
    if not query:
        # Return recent users except self
        users = db.query(User).filter(User.id != current_user.id).limit(20).all()
        return users

    users = db.query(User).filter(
        User.id != current_user.id,
        or_(
            func.lower(User.username).contains(query),
            func.lower(User.email).contains(query)
        )
    ).limit(30).all()
    return users

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    media_type = validate_uploaded_file(file, content)

    if media_type != "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be an image file (.jpg, .png, .gif, .webp)."
        )

    upload_dir = os.path.join(os.getcwd(), "uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    avatar_url = f"/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)

    return current_user

@router.post("/block/{user_id}")
def block_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.friendship import Block
    existing_block = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == user_id
    ).first()

    if existing_block:
        return {"message": "User is already blocked", "blocked": True}

    new_block = Block(
        id=str(uuid.uuid4()),
        blocker_id=current_user.id,
        blocked_id=user_id
    )
    db.add(new_block)
    db.commit()
    return {"message": "User blocked successfully", "blocked": True}

@router.post("/unblock/{user_id}")
def unblock_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.friendship import Block
    block_record = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == user_id
    ).first()

    if not block_record:
        return {"message": "User was not blocked", "blocked": False}

    db.delete(block_record)
    db.commit()
    return {"message": "User unblocked successfully", "blocked": False}

@router.get("/blocked/list", response_model=List[UserResponse])
def get_blocked_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.friendship import Block
    blocks = db.query(Block).filter(Block.blocker_id == current_user.id).all()
    blocked_ids = [b.blocked_id for b in blocks]
    blocked_users = db.query(User).filter(User.id.in_(blocked_ids)).all()
    return [UserResponse.model_validate(u) for u in blocked_users]

