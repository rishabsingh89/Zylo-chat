from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.user import UserResponse

class ChatCreate(BaseModel):
    receiver_id: str

class GroupChatCreate(BaseModel):
    name: str
    member_ids: List[str]
    avatar_url: Optional[str] = None

class ChatMemberResponse(BaseModel):
    user: UserResponse
    joined_at: datetime

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    id: str
    is_group: bool
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    admin_id: Optional[str] = None
    created_at: datetime
    members: List[UserResponse] = []
    unread_count: int = 0
    last_message: Optional[dict] = None

    class Config:
        from_attributes = True
