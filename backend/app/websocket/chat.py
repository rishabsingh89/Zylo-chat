import json
from datetime import datetime
from typing import Dict, List
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User

class ConnectionManager:
    def __init__(self):
        # Map user_id to list of active WebSockets (to support multi-tab/devices)
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        # Update DB: User is online
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_online = True
                db.commit()

            # Find and update pending "sent" messages to "delivered"
            from app.models.message import Message
            sent_messages = db.query(Message).filter(Message.receiver_id == user_id, Message.status == "sent").all()
            if sent_messages:
                for m in sent_messages:
                    m.status = "delivered"
                db.commit()
                # Notify senders in real-time
                for m in sent_messages:
                    await self.send_personal_message({
                        "type": "message_status",
                        "message_id": m.id,
                        "status": "delivered"
                    }, m.sender_id)
        finally:
            db.close()

        # Broadcast online presence
        await self.broadcast({
            "type": "presence",
            "user_id": user_id,
            "is_online": True
        })

    async def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

                # Update DB: User is offline, set last_seen
                now = datetime.utcnow()
                db: Session = SessionLocal()
                try:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        user.is_online = False
                        user.last_seen = now
                        db.commit()
                finally:
                    db.close()

                # Broadcast offline presence
                await self.broadcast({
                    "type": "presence",
                    "user_id": user_id,
                    "is_online": False,
                    "last_seen": now.isoformat()
                })

    async def send_personal_message(self, data: dict, user_id: str):
        if user_id in self.active_connections:
            dead_sockets = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(json.dumps(data))
                except Exception:
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                self.active_connections[user_id].remove(ws)

    async def broadcast(self, data: dict):
        message_str = json.dumps(data)
        for user_id, sockets in list(self.active_connections.items()):
            for ws in sockets:
                try:
                    await ws.send_text(message_str)
                except Exception:
                    pass

manager = ConnectionManager()
