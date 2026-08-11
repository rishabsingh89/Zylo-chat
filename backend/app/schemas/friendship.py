from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserResponse

class FriendRequestCreate(BaseModel):
    friend_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None

class FriendRequestResponse(BaseModel):
    id: str
    user_id: str
    friend_id: str
    status: str
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class FriendshipStatusResponse(BaseModel):
    status: str # 'none', 'friends', 'pending_sent', 'pending_received', 'blocked'

class BlockResponse(BaseModel):
    id: str
    blocker_id: str
    blocked_id: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ChatPreferenceUpdate(BaseModel):
    is_archived: Optional[bool] = None
    is_pinned: Optional[bool] = None
    is_muted: Optional[bool] = None

class ChatPreferenceResponse(BaseModel):
    user_id: str
    target_user_id: str
    is_archived: bool
    is_pinned: bool
    is_muted: bool

    class Config:
        from_attributes = True
