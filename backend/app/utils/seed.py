import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User
from app.utils.security import hash_password

SEED_USERS = [
    {
        "username": "thomas",
        "email": "thomas@zylo.com",
        "password": "password123",
    },
    {
        "username": "thomas_wright",
        "email": "thomas.wright@zylo.com",
        "password": "password123",
    },
    {
        "username": "alex_rivera",
        "email": "alex@zylo.com",
        "password": "password123",
    },
    {
        "username": "sarah_chen",
        "email": "sarah@zylo.com",
        "password": "password123",
    },
    {
        "username": "emma_watson",
        "email": "emma@zylo.com",
        "password": "password123",
    },
    {
        "username": "david_miller",
        "email": "david@zylo.com",
        "password": "password123",
    },
    {
        "username": "john_doe",
        "email": "john@zylo.com",
        "password": "password123",
    },
    {
        "username": "AliceVibly",
        "email": "alice@zylo.com",
        "password": "password123",
    },
    {
        "username": "BobVibly",
        "email": "bob@zylo.com",
        "password": "password123",
    },
]

def seed_demo_users(db: Session):
    """Seed initial demo users if they do not already exist in DB."""
    try:
        for udata in SEED_USERS:
            existing = db.query(User).filter(
                (User.username.ilike(udata["username"])) | (User.email.ilike(udata["email"]))
            ).first()
            if not existing:
                user = User(
                    id=str(uuid.uuid4()),
                    username=udata["username"],
                    email=udata["email"],
                    password_hash=hash_password(udata["password"]),
                    is_online=False,
                    created_at=datetime.utcnow()
                )
                db.add(user)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Seed] Auto-seed warning: {e}")
