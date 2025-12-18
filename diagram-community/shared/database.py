from sqlalchemy import create_engine, Column, String, Integer, DateTime, JSON, Text, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()


class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(String, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    format = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    user_id = Column(String, nullable=False)
    username = Column(String, nullable=True)
    file_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    services = Column(JSON, default=list)
    categories = Column(JSON, default=dict)
    raw_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    views = Column(Integer, default=0)
    remixes = Column(Integer, default=0)
    exports = Column(Integer, default=0)


def get_database_url():
    return os.getenv("DATABASE_URL", "postgresql://cloudmigrate:cloudmigrate2025@postgres:5432/cloudmigrate")


def create_db_engine():
    return create_engine(get_database_url())


def get_session_maker():
    engine = create_db_engine()
    return sessionmaker(bind=engine)


def init_db():
    engine = create_db_engine()
    Base.metadata.create_all(engine)
