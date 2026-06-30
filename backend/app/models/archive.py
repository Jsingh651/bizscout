"""
Archive tables for leads that leave the active shared pool.

A lead is removed from ``leads`` (and from every user's dashboard) in two cases:

* RejectedLead   — more than 5 distinct users marked the lead "Not Interested".
                   The business is a confirmed dead end, so it is retired for
                   everyone instead of wasting other reps' time.
* SuccessfulLead — a user reached "Closed Won" (the business bought a site).
                   A sold business no longer needs outreach, so it is retired
                   for everyone and credited to the user who closed it.

Both tables keep a self-contained snapshot of the lead's business data so the
original ``leads`` row can be deleted without losing history.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class _LeadSnapshotMixin:
    """Columns copied verbatim from the originating lead."""

    id                 = Column(Integer, primary_key=True, index=True)
    original_lead_id   = Column(Integer, index=True)
    name               = Column(String, nullable=True)
    city               = Column(String, nullable=True)
    phone              = Column(String, nullable=True)
    address            = Column(String, nullable=True)
    website_status     = Column(String, nullable=True)
    website_url        = Column(String, nullable=True)
    category           = Column(String, nullable=True)
    rating             = Column(Float, nullable=True)
    review_count       = Column(Integer, nullable=True)
    business_age_years = Column(Integer, nullable=True)
    score              = Column(Integer, nullable=True)
    batch_id           = Column(Integer, nullable=True, index=True)


class RejectedLead(_LeadSnapshotMixin, Base):
    __tablename__ = "rejected_leads"

    reject_count = Column(Integer, nullable=False, default=0)
    rejected_at  = Column(DateTime(timezone=True), server_default=func.now())


class SuccessfulLead(_LeadSnapshotMixin, Base):
    __tablename__ = "successful_leads"

    closed_by_user_id = Column(Integer, index=True, nullable=True)
    closed_by_email   = Column(String, nullable=True)
    closed_at         = Column(DateTime(timezone=True), server_default=func.now())
