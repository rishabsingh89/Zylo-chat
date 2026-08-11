import os
from passlib.context import CryptContext
from fastapi import HTTPException, status, UploadFile

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_MB", 25)) * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".mp4", ".mov", ".webm", ".avi",
    ".mp3", ".wav", ".ogg", ".m4a",
    ".pdf", ".doc", ".docx", ".txt", ".zip"
}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".avi"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a"}

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_media_type(ext: str) -> str:
    ext = ext.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    if ext in AUDIO_EXTS:
        return "audio"
    return "document"

def validate_uploaded_file(file: UploadFile, content: bytes):
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not allowed."
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        max_mb = os.getenv("MAX_FILE_SIZE_MB", 25)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit of {max_mb}MB."
        )

    return get_media_type(ext)
