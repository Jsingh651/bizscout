from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id                 = Column(Integer,              primary_key=True, index=True)
    name               = Column(String,               nullable=True)
    city               = Column(String,               nullable=True)
    phone              = Column(String,               nullable=True)
    address            = Column(String,               nullable=True)
    website_status     = Column(String,               nullable=True)
    website_url        = Column(String,               nullable=True)
    category           = Column(String,               nullable=True)
    rating             = Column(Float,                nullable=True)
    review_count       = Column(Integer,              nullable=True)
    business_age_years = Column(Integer,              nullable=True)
    score              = Column(Integer,              nullable=True)
    pipeline_stage     = Column(String,               default="New Lead")
    notes              = Column(String,               nullable=True)
    call_outcome       = Column(String,               nullable=True)
    call_outcome_at    = Column(DateTime(timezone=True), nullable=True)
    batch_id           = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)