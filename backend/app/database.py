import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# If running on Vercel without explicit DATABASE_URL, use /tmp directory for SQLite
default_sqlite = "/tmp/zylochat.db" if os.getenv("VERCEL") else "./zylochat.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_sqlite}")

# Supabase fix: convert legacy postgres:// to postgresql:// for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

sqlite_url = f"sqlite:///{default_sqlite}"

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    else:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Test connection
        with engine.connect() as conn:
            pass
except Exception as db_err:
    print(f"[Database] Primary DB failed ({db_err}). Falling back to SQLite: {sqlite_url}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
