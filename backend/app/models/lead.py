from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
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

    # Global lifecycle. A lead leaves the shared pool when it is sold ("successful")
    # or rejected by more than 5 distinct users ("rejected"). It is soft-archived
    # (hidden from every read) rather than hard-deleted so signed contracts and
    # invoices that reference it stay intact; the canonical record is copied to
    # the rejected_leads / successful_leads tables.
    is_archived        = Column(Boolean, default=False, index=True)
    archived_reason    = Column(String, nullable=True)   # 'rejected' | 'successful'

    # NOTE: pipeline_stage / notes / call_outcome above are legacy per-lead globals,
    # superseded by the per-user LeadPipeline table. Kept only for back-compat.