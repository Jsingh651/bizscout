from sqlalchemy import Column, Integer, String, Float, ForeignKey
from app.database import Base

class Lead(Base):
    __tablename__ = "leads"

    id                 = Column(Integer, primary_key=True, index=True)
    name               = Column(String)
    city               = Column(String)
    phone              = Column(String)
    address            = Column(String,  nullable=True)
    website_status     = Column(String)
    website_url        = Column(String,  nullable=True)
    category           = Column(String,  nullable=True)
    rating             = Column(Float,   nullable=True)
    review_count       = Column(Integer, nullable=True)
    business_age_years = Column(Integer, nullable=True)
    score              = Column(Integer)
    pipeline_stage     = Column(String,  default="New Lead")
    batch_id           = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)