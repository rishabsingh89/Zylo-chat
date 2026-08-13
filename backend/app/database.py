import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
default_sqlite_path = os.path.join(BASE_DIR, "zylochat.db")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# If DATABASE_URL is not set or is a relative sqlite path, use absolute path
if not DATABASE_URL or DATABASE_URL.startswith("sqlite:///./"):
    DATABASE_URL = f"sqlite:///{default_sqlite_path}"

# Supabase fix: convert legacy postgres:// to postgresql:// for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

sqlite_url = f"sqlite:///{default_sqlite_path}"

print(f"[Database] Using: {DATABASE_URL}")

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 15}, pool_pre_ping=True)
    else:
        # Standard configuration for connection pooling with cloud/pooler DBs to prevent stale connection errors
        engine = create_engine(
            DATABASE_URL, 
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30
        )
        # Test connection
        with engine.connect() as conn:
            pass
except Exception as db_err:
    print(f"[Database] Primary DB failed ({db_err}). Falling back to SQLite: {sqlite_url}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False, "timeout": 15}, pool_pre_ping=True)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if str(engine.url).startswith("sqlite"):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_sqlite_migrations():
    """Ensure SQLite tables have all required columns from updated models."""
    if not str(engine.url).startswith("sqlite"):
        return
    try:
        with engine.begin() as conn:
            # Check users table columns
            res = conn.exec_driver_sql("PRAGMA table_info(users)")
            existing_cols = {row[1] for row in res.fetchall()}
            if existing_cols:
                if "name" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN name VARCHAR")
                if "updated_at" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN updated_at DATETIME")
                if "avatar_url" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN avatar_url VARCHAR")
                if "is_online" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT 0")
                if "last_seen" not in existing_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN last_seen DATETIME")
    except Exception as err:
        print(f"[Database] Migration warning: {err}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

