import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.database import get_db
from app.models.user import User
from app.models.friendship import Friendship, Block
from app.schemas.friendship import FriendRequestCreate, FriendRequestResponse, FriendshipStatusResponse
from app.schemas.user import UserResponse
from app.utils.auth import get_current_user
from app.websocket.chat import manager

router = APIRouter(prefix="/api/friends", tags=["Friends & Contacts"])

@router.post("/request")
@router.post("/requests")
async def send_friend_request(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_user = None
    target_id = payload.friend_id or getattr(payload, 'receiver_id', None)
    if target_id and target_id.strip():
        target_user = db.query(User).filter(User.id == target_id.strip()).first()
    if not target_user and payload.username and payload.username.strip():
        target_user = db.query(User).filter(
            User.username.ilike(payload.username.strip()),
            User.password_hash != "pending_invite_account"
        ).first()
    if not target_user and payload.email and payload.email.strip():
        target_user = db.query(User).filter(
            User.email.ilike(payload.email.strip()),
            User.password_hash != "pending_invite_account"
        ).first()

    if not target_user:
        raw_target = (payload.email or payload.username or target_id or "").strip()
        if raw_target:
            target_user = db.query(User).filter(
                User.password_hash != "pending_invite_account",
                or_(
                    User.username.ilike(raw_target),
                    User.email.ilike(raw_target),
                    User.name.ilike(raw_target)
                )
            ).first()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="No registered user found with this username or email. Please ask them to sign up first."
        )

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    # Check if blocked
    is_blocked = db.query(Block).filter(
        or_(
            and_(Block.blocker_id == current_user.id, Block.blocked_id == target_user.id),
            and_(Block.blocker_id == target_user.id, Block.blocked_id == current_user.id)
        )
    ).first()
    if is_blocked:
        raise HTTPException(status_code=400, detail="Cannot send friend request to this user")

    # Check existing friendship or request
    existing = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.friend_id == target_user.id),
            and_(Friendship.user_id == target_user.id, Friendship.friend_id == current_user.id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="You are already friends")
        if existing.status == "pending":
            if existing.user_id == current_user.id:
                raise HTTPException(status_code=400, detail="Friend request already sent")
            else:
                # Other user already sent request, so auto-accept
                existing.status = "accepted"
                db.commit()
                db.refresh(existing)
                # WS notification
                await manager.send_personal_message({
                    "type": "friend_accepted",
                    "user": UserResponse.model_validate(current_user).model_dump(mode="json")
                }, target_user.id)
                return {"message": "Friend request accepted", "status": "accepted", "id": existing.id}

    # Create new pending friendship
    friendship = Friendship(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        friend_id=target_user.id,
        status="pending"
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    # Real-time WebSocket notification to target user
    await manager.send_personal_message({
        "type": "friend_request",
        "request": {
            "id": friendship.id,
            "sender": UserResponse.model_validate(current_user).model_dump(mode="json"),
            "created_at": friendship.created_at.isoformat()
        }
    }, target_user.id)

    return {"message": "Friend request sent successfully", "id": friendship.id, "status": "pending"}

@router.get("/requests")
def get_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Incoming requests
    incoming = db.query(Friendship).filter(
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending"
    ).order_by(Friendship.created_at.desc()).all()

    # Outgoing requests
    outgoing = db.query(Friendship).filter(
        Friendship.user_id == current_user.id,
        Friendship.status == "pending"
    ).order_by(Friendship.created_at.desc()).all()

    incoming_list = []
    for req in incoming:
        sender = db.query(User).filter(User.id == req.user_id).first()
        if sender:
            incoming_list.append({
                "id": req.id,
                "user_id": req.user_id,
                "friend_id": req.friend_id,
                "status": req.status,
                "created_at": req.created_at.isoformat(),
                "sender": UserResponse.model_validate(sender).model_dump(mode="json")
            })

    outgoing_list = []
    for req in outgoing:
        receiver = db.query(User).filter(User.id == req.friend_id).first()
        if receiver:
            outgoing_list.append({
                "id": req.id,
                "user_id": req.user_id,
                "friend_id": req.friend_id,
                "status": req.status,
                "created_at": req.created_at.isoformat(),
                "receiver": UserResponse.model_validate(receiver).model_dump(mode="json")
            })

    return {
        "incoming": incoming_list,
        "outgoing": outgoing_list
    }

@router.post("/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(Friendship).filter(
        or_(
            and_(Friendship.id == request_id, Friendship.friend_id == current_user.id),
            and_(Friendship.user_id == request_id, Friendship.friend_id == current_user.id)
        )
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")

    friendship.status = "accepted"
    db.commit()

    sender = db.query(User).filter(User.id == friendship.user_id).first()
    if sender:
        await manager.send_personal_message({
            "type": "friend_accepted",
            "user": UserResponse.model_validate(current_user).model_dump(mode="json")
        }, sender.id)

    return {"message": "Friend request accepted", "id": friendship.id}

@router.post("/reject/{request_id}")
def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(Friendship).filter(
        or_(
            Friendship.id == request_id,
            and_(Friendship.user_id == request_id, Friendship.friend_id == current_user.id),
            and_(Friendship.friend_id == request_id, Friendship.user_id == current_user.id)
        )
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")

    db.delete(friendship)
    db.commit()
    return {"message": "Friend request removed"}

@router.get("", response_model=List[UserResponse])
def get_friends_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendships = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.status == "accepted"),
            and_(Friendship.friend_id == current_user.id, Friendship.status == "accepted")
        )
    ).all()

    friend_ids = []
    for f in friendships:
        if f.user_id == current_user.id:
            friend_ids.append(f.friend_id)
        else:
            friend_ids.append(f.user_id)

    friends = db.query(User).filter(User.id.in_(friend_ids)).all()
    return [UserResponse.model_validate(u) for u in friends]

@router.delete("/{friend_id}")
def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend_id),
            and_(Friendship.user_id == friend_id, Friendship.friend_id == current_user.id)
        )
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")

    db.delete(friendship)
    db.commit()
    return {"message": "Friend removed successfully"}

@router.get("/status/{user_id}", response_model=FriendshipStatusResponse)
def get_friendship_status(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check block
    blocked = db.query(Block).filter(
        or_(
            and_(Block.blocker_id == current_user.id, Block.blocked_id == user_id),
            and_(Block.blocker_id == user_id, Block.blocked_id == current_user.id)
        )
    ).first()
    if blocked:
        return FriendshipStatusResponse(status="blocked")

    friendship = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_id),
            and_(Friendship.user_id == user_id, Friendship.friend_id == current_user.id)
        )
    ).first()

    if not friendship:
        return FriendshipStatusResponse(status="none")

    if friendship.status == "accepted":
        return FriendshipStatusResponse(status="friends")

    if friendship.status == "pending":
        if friendship.user_id == current_user.id:
            return FriendshipStatusResponse(status="pending_sent")
        else:
            return FriendshipStatusResponse(status="pending_received")

    return FriendshipStatusResponse(status="none")
