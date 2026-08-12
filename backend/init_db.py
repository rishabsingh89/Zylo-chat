import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, DATABASE_URL
print("Connecting to:", DATABASE_URL)
from app.models.user import User
from app.models.chat import Chat
from app.models.message import Message
from app.models.friendship import Friendship, Block

Base.metadata.create_all(bind=engine)
print('TABLES CREATED IN SUPABASE!')
