import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from app.database import Base

class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    is_group = Column(Boolean, default=False)
    name = Column(String, nullable=True)         # Group name
    avatar_url = Column(String, nullable=True)   # Group avatar
    admin_id = Column(String, ForeignKey("users.id"), nullable=True) # Group admin
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMember(Base):
    __tablename__ = "chat_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
