import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from app.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id", ondelete="CASCADE"), nullable=True, index=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    content = Column(String, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=True)   # 'image', 'video', 'audio', 'document'
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    reply_to_id = Column(String, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    is_forwarded = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    is_encrypted = Column(Boolean, default=False)
    iv = Column(String, nullable=True)

    status = Column(String, default="sent")      # 'sent', 'delivered', 'read'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
