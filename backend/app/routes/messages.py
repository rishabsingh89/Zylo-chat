import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models.user import User
from app.models.chat import Chat, ChatMember
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageUpdate, MessageResponse, MessageStatusUpdate
from app.utils.auth import get_current_user
from app.utils.security import validate_uploaded_file, get_media_type
from app.websocket.chat import manager

router = APIRouter(prefix="/api/messages", tags=["Messages"])

@router.get("/conversations")
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find all users current_user has messaged with
    sent_receivers = db.query(Message.receiver_id).filter(Message.sender_id == current_user.id, Message.receiver_id.isnot(None)).distinct().all()
    received_senders = db.query(Message.sender_id).filter(Message.receiver_id == current_user.id).distinct().all()

    # Also find accepted friends
    from app.models.friendship import Friendship
    friendships = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.status == "accepted"),
            and_(Friendship.friend_id == current_user.id, Friendship.status == "accepted")
        )
    ).all()
    friend_ids = [f.friend_id if f.user_id == current_user.id else f.user_id for f in friendships]

    user_ids = list(set([r[0] for r in sent_receivers] + [s[0] for s in received_senders] + friend_ids))
    users = db.query(User).filter(User.id.in_(user_ids)).all()

    result = []
    for u in users:
        last_msg = (
            db.query(Message)
            .filter(
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == u.id),
                    and_(Message.receiver_id == current_user.id, Message.sender_id == u.id)
                )
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        result.append({
            "user": {
                "id": u.id,
                "_id": u.id,
                "username": u.username,
                "email": u.email,
                "avatar_url": u.avatar_url,
                "is_online": u.is_online,
                "last_seen": u.last_seen.isoformat() if u.last_seen else None
            },
            "lastMessage": {
                "id": last_msg.id,
                "_id": last_msg.id,
                "content": last_msg.content,
                "sender": last_msg.sender_id,
                "receiver": last_msg.receiver_id,
                "createdAt": last_msg.created_at.isoformat(),
                "status": last_msg.status,
                "media_type": last_msg.media_type
            } if last_msg else None
        })

    return result

@router.get("/{receiver_or_chat_id}", response_model=List[MessageResponse])
def get_messages(
    receiver_or_chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if target is a chat group ID or a user ID
    is_chat = db.query(Chat).filter(Chat.id == receiver_or_chat_id).first()

    if is_chat:
        messages = (
            db.query(Message)
            .filter(Message.chat_id == receiver_or_chat_id)
            .order_by(Message.created_at.asc())
            .all()
        )
    else:
        messages = (
            db.query(Message)
            .filter(
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == receiver_or_chat_id),
                    and_(Message.sender_id == receiver_or_chat_id, Message.receiver_id == current_user.id)
                )
            )
            .order_by(Message.created_at.asc())
            .all()
        )

        # Mark unread messages from this user as read
        unread = [m for m in messages if m.receiver_id == current_user.id and m.status != "read"]
        if unread:
            for m in unread:
                m.status = "read"
            db.commit()

    return messages

@router.post("/send", response_model=MessageResponse)
async def send_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not payload.content and not payload.media_url:
        raise HTTPException(status_code=400, detail="Message content or media is required.")

    # Check if either user has blocked the other
    if payload.receiver_id:
        from app.models.friendship import Block
        blocked = db.query(Block).filter(
            or_(
                and_(Block.blocker_id == current_user.id, Block.blocked_id == payload.receiver_id),
                and_(Block.blocker_id == payload.receiver_id, Block.blocked_id == current_user.id)
            )
        ).first()
        if blocked:
            raise HTTPException(
                status_code=403,
                detail="Cannot send message because one of the users is blocked."
            )


    new_msg = Message(
        chat_id=payload.chat_id,
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=payload.content,
        media_url=payload.media_url,
        media_type=payload.media_type,
        file_name=payload.file_name,
        file_size=payload.file_size,
        reply_to_id=payload.reply_to_id,
        is_forwarded=payload.is_forwarded,
        status="sent"
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Real-time WebSocket push to receiver if connected
    if payload.receiver_id:
        msg_payload = {
            "type": "new_message",
            "message": {
                "id": new_msg.id,
                "_id": new_msg.id,
                "sender": new_msg.sender_id,
                "receiver": new_msg.receiver_id,
                "content": new_msg.content,
                "media_url": new_msg.media_url,
                "media_type": new_msg.media_type,
                "file_name": new_msg.file_name,
                "file_size": new_msg.file_size,
                "reply_to_id": new_msg.reply_to_id,
                "is_forwarded": new_msg.is_forwarded,
                "status": new_msg.status,
                "createdAt": new_msg.created_at.isoformat()
            }
        }
        await manager.send_personal_message(msg_payload, payload.receiver_id)

    return new_msg

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    media_type = validate_uploaded_file(file, content)

    upload_dir = os.path.join(os.getcwd(), "uploads", media_type + "s")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{media_type}_{uuid.uuid4().hex[:10]}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    media_url = f"/uploads/{media_type}s/{filename}"

    return {
        "media_url": media_url,
        "media_type": media_type,
        "file_name": file.filename,
        "file_size": len(content)
    }

@router.put("/{message_id}", response_model=MessageResponse)
def edit_message(
    message_id: str,
    payload: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")

    msg.content = payload.content
    msg.is_edited = True
    db.commit()
    db.refresh(msg)
    return msg

@router.delete("/{message_id}")
def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.sender_id != current_user.id and msg.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(msg)
    db.commit()
    return {"success": True, "message": "Message deleted"}

@router.delete("/clear/{receiver_id}")
def clear_chat_history(
    receiver_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == receiver_id),
            and_(Message.receiver_id == current_user.id, Message.sender_id == receiver_id)
        )
    ).delete(synchronize_session=False)

    db.commit()
    return {"success": True, "message": "Chat history cleared"}

@router.put("/status/{message_id}")
async def update_message_status(
    message_id: str,
    payload: MessageStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.status = payload.status
    db.commit()

    # Broadcast status change to original sender
    status_event = {
        "type": "message_status",
        "message_id": msg.id,
        "status": payload.status
    }
    await manager.send_personal_message(status_event, msg.sender_id)

    return {"success": True, "status": payload.status}
