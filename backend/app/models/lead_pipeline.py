from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Index,
)
from sqlalchemy.sql import func
from app.database import Base


class LeadPipeline(Base):
    """
    Per-user CRM state for a shared lead.

    The ``leads`` table is a single shared pool that every account can see.
    Each user, however, works that pool independently: their pipeline stage,
    notes and call outcome for a given lead live here, keyed on
    (user_id, lead_id). One user marking a lead "Not Interested" therefore has
    no effect on how that same lead looks to anyone else.
    """

    __tablename__ = "lead_pipeline"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id         = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)

    pipeline_stage  = Column(String, nullable=False, default="New Lead")
    notes           = Column(String, nullable=True)
    call_outcome    = Column(String, nullable=True)
    call_outcome_at = Column(DateTime(timezone=True), nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "lead_id", name="uq_lead_pipeline_user_lead"),
        Index("ix_lead_pipeline_lead_outcome", "lead_id", "call_outcome"),
    )
