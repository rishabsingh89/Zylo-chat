from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class MessageCreate(BaseModel):
    chat_id: Optional[str] = None
    receiver_id: Optional[str] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    reply_to_id: Optional[str] = None
    is_forwarded: bool = False
    is_encrypted: bool = False
    iv: Optional[str] = None

class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1)

class MessageStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(sent|delivered|read)$")

class MessageResponse(BaseModel):
    id: str
    chat_id: Optional[str] = None
    sender_id: str
    receiver_id: Optional[str] = None
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    reply_to_id: Optional[str] = None
    is_forwarded: bool = False
    is_edited: bool = False
    is_encrypted: bool = False
    iv: Optional[str] = None
    status: str = "sent"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
