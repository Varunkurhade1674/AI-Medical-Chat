"""
Database engine and session configuration.

Sets up a SQLite database via SQLAlchemy and exposes:
- Base: the declarative base every model inherits from
- init_db(): creates all tables on startup
- get_db(): a FastAPI dependency that yields a scoped session
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medical_chatbot.db")

# check_same_thread=False is required for SQLite when used with FastAPI's
# threaded request handling.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    """Create all database tables if they do not already exist."""
    from database import models  # noqa: F401  imported here to register models

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
