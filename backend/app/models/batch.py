from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Batch(Base):
    __tablename__ = "batches"

    id           = Column(Integer, primary_key=True, index=True)
    query        = Column(String, nullable=False)   # niche  e.g. "Food Trucks"
    location     = Column(String, nullable=False)   # city   e.g. "Sacramento, CA"
    created_at   = Column(DateTime(timezone=True), server_default=func.now())