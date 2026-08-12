"""Quick diagnostic: check which DB file the server uses and its schema."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, DATABASE_URL, default_sqlite_path
from app.models.user import User

print("=" * 60)
print(f"DATABASE_URL env var : {os.getenv('DATABASE_URL', '(not set)')}")
print(f"Resolved DATABASE_URL: {DATABASE_URL}")
print(f"Engine URL           : {engine.url}")
print(f"Absolute DB path     : {default_sqlite_path}")
print(f"DB file exists       : {os.path.exists(default_sqlite_path)}")
print("=" * 60)

# Check actual columns in the DB
import sqlite3
db_path = str(engine.url).replace("sqlite:///", "")
print(f"Connecting to: {db_path}")
conn = sqlite3.connect(db_path)
cols = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
print(f"Actual DB columns: {cols}")

model_cols = [c.name for c in User.__table__.columns]
print(f"Model columns    : {model_cols}")

missing = set(model_cols) - set(cols)
if missing:
    print(f"\n*** MISSING COLUMNS IN DB: {missing} ***")
    print("This is causing the 500 error!")
else:
    print("\nAll model columns exist in DB. Schema is OK.")

# Try a test registration
from app.database import SessionLocal
from app.utils.security import hash_password
import uuid

db = SessionLocal()
try:
    test_user = User(
        id=str(uuid.uuid4()),
        name="DiagTest",
        username=f"diagtest_{uuid.uuid4().hex[:6]}",
        email=f"diagtest_{uuid.uuid4().hex[:6]}@test.com",
        password_hash=hash_password("test123"),
        is_online=True
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    print(f"\nTest user created OK: {test_user.username} (id={test_user.id})")
    # Clean up
    db.delete(test_user)
    db.commit()
    print("Test user cleaned up.")
except Exception as e:
    db.rollback()
    print(f"\n*** REGISTRATION TEST FAILED: {e} ***")
finally:
    db.close()

conn.close()
