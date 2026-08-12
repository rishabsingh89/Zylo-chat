import sys
import os

# Add root backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.main import app  # type: ignore

# Vercel Serverless Function entry point
app = app
