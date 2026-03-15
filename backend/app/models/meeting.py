from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func

from app.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    prospect_name = Column(String, nullable=True)
    email = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)

    zoom_meeting_id = Column(String, nullable=True)
    zoom_join_url = Column(String, nullable=True)
    zoom_start_url = Column(String, nullable=True)

    reminder_scheduled = Column(Boolean, nullable=False, default=False)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

