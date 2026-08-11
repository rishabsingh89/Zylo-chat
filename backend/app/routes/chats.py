from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models.user import User
from app.models.chat import Chat, ChatMember
from app.models.message import Message
from app.schemas.chat import ChatCreate, GroupChatCreate, ChatResponse
from app.schemas.user import UserResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/chats", tags=["Chats & Groups"])

@router.get("", response_model=List[ChatResponse])
def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find all chats where user is a member
    memberships = db.query(ChatMember).filter(ChatMember.user_id == current_user.id).all()
    chat_ids = [m.chat_id for m in memberships]

    chats = db.query(Chat).filter(Chat.id.in_(chat_ids)).order_by(Chat.created_at.desc()).all()
    result = []

    for chat in chats:
        # Get all members
        m_records = db.query(ChatMember).filter(ChatMember.chat_id == chat.id).all()
        m_user_ids = [m.user_id for m in m_records]
        member_users = db.query(User).filter(User.id.in_(m_user_ids)).all()

        # Get last message
        last_msg = (
            db.query(Message)
            .filter(
                or_(
                    Message.chat_id == chat.id,
                    and_(Message.sender_id == current_user.id, Message.receiver_id.in_(m_user_ids)),
                    and_(Message.receiver_id == current_user.id, Message.sender_id.in_(m_user_ids))
                )
            )
            .order_by(Message.created_at.desc())
            .first()
        )

        last_msg_dict = None
        if last_msg:
            last_msg_dict = {
                "id": last_msg.id,
                "content": last_msg.content,
                "sender_id": last_msg.sender_id,
                "created_at": last_msg.created_at.isoformat(),
                "status": last_msg.status,
                "media_type": last_msg.media_type
            }

        # Calculate unread count
        unread = (
            db.query(Message)
            .filter(
                Message.receiver_id == current_user.id,
                Message.status != "read"
            )
            .count()
        )

        result.append(
            ChatResponse(
                id=chat.id,
                is_group=chat.is_group,
                name=chat.name,
                avatar_url=chat.avatar_url,
                admin_id=chat.admin_id,
                created_at=chat.created_at,
                members=[UserResponse.model_validate(u) for u in member_users],
                unread_count=unread,
                last_message=last_msg_dict
            )
        )

    return result

@router.post("/direct", response_model=ChatResponse)
def get_or_create_direct_chat(
    payload: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    receiver = db.query(User).filter(User.id == payload.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver user not found")

    # Check if a 1-on-1 chat already exists
    user_chats = db.query(ChatMember.chat_id).filter(ChatMember.user_id == current_user.id).all()
    user_chat_ids = [c[0] for c in user_chats]

    existing = (
        db.query(ChatMember)
        .join(Chat, Chat.id == ChatMember.chat_id)
        .filter(
            Chat.is_group == False,
            ChatMember.chat_id.in_(user_chat_ids),
            ChatMember.user_id == payload.receiver_id
        )
        .first()
    )

    if existing:
        chat = db.query(Chat).filter(Chat.id == existing.chat_id).first()
        m_users = [current_user, receiver]
        return ChatResponse(
            id=chat.id,
            is_group=False,
            name=receiver.username,
            avatar_url=receiver.avatar_url,
            admin_id=None,
            created_at=chat.created_at,
            members=[UserResponse.model_validate(u) for u in m_users]
        )

    # Create new 1-on-1 chat
    new_chat = Chat(is_group=False)
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    db.add(ChatMember(chat_id=new_chat.id, user_id=current_user.id))
    db.add(ChatMember(chat_id=new_chat.id, user_id=receiver.id))
    db.commit()

    return ChatResponse(
        id=new_chat.id,
        is_group=False,
        name=receiver.username,
        avatar_url=receiver.avatar_url,
        admin_id=None,
        created_at=new_chat.created_at,
        members=[UserResponse.model_validate(u) for u in [current_user, receiver]]
    )

@router.post("/group", response_model=ChatResponse)
def create_group_chat(
    payload: GroupChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = Chat(
        is_group=True,
        name=payload.name,
        avatar_url=payload.avatar_url,
        admin_id=current_user.id
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    # Add admin and members
    all_member_ids = list(set([current_user.id] + payload.member_ids))
    for m_id in all_member_ids:
        db.add(ChatMember(chat_id=group.id, user_id=m_id))
    db.commit()

    members = db.query(User).filter(User.id.in_(all_member_ids)).all()
    return ChatResponse(
        id=group.id,
        is_group=True,
        name=group.name,
        avatar_url=group.avatar_url,
        admin_id=group.admin_id,
        created_at=group.created_at,
        members=[UserResponse.model_validate(u) for u in members]
    )

@router.post("/archive/{target_user_id}")
def archive_chat(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.friendship import ChatPreference
    pref = db.query(ChatPreference).filter(
        ChatPreference.user_id == current_user.id,
        ChatPreference.target_user_id == target_user_id
    ).first()

    if not pref:
        import uuid
        pref = ChatPreference(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            target_user_id=target_user_id,
            is_archived=True
        )
        db.add(pref)
    else:
        pref.is_archived = True

    db.commit()
    return {"message": "Chat archived", "is_archived": True, "target_user_id": target_user_id}

@router.post("/unarchive/{target_user_id}")
def unarchive_chat(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.friendship import ChatPreference
    pref = db.query(ChatPreference).filter(
        ChatPreference.user_id == current_user.id,
        ChatPreference.target_user_id == target_user_id
    ).first()

    if pref:
        pref.is_archived = False
        db.commit()

    return {"message": "Chat unarchived", "is_archived": False, "target_user_id": target_user_id}

@router.get("/preferences")
def get_chat_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.friendship import ChatPreference
    prefs = db.query(ChatPreference).filter(ChatPreference.user_id == current_user.id).all()
    return [
        {
            "target_user_id": p.target_user_id,
            "is_archived": p.is_archived,
            "is_pinned": p.is_pinned,
            "is_muted": p.is_muted
        }
        for p in prefs
    ]

