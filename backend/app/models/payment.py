# app/models/payment.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Numeric, Text
from sqlalchemy.sql import func
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id                     = Column(Integer, primary_key=True, index=True)

    # Links — contract_id goes NULL if contract deleted, lead_id stays forever
    lead_id                = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id            = Column(Integer, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Snapshot of client/designer info at time of invoice (survives deletions)
    client_name            = Column(String, nullable=True)
    client_email           = Column(String, nullable=True)
    designer_name          = Column(String, nullable=True)

    # Pricing snapshot
    setup_price            = Column(Numeric, nullable=True)
    monthly_price          = Column(Numeric, nullable=True)
    monthly_discount       = Column(Numeric, nullable=True, default=10)

    # Plan & status
    payment_plan           = Column(String, nullable=True)   # 'full' | 'split'
    deposit_paid           = Column(Boolean, default=False)
    deposit_paid_at        = Column(DateTime(timezone=True), nullable=True)
    final_paid             = Column(Boolean, default=False)
    final_paid_at          = Column(DateTime(timezone=True), nullable=True)

    # Stripe
    payment_token          = Column(String, unique=True, index=True, nullable=True)
    stripe_customer_id     = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    payment_failed         = Column(Boolean, default=False)
    last_failed_at         = Column(DateTime(timezone=True), nullable=True)
    last_failure_reason    = Column(String, nullable=True)

    # Dates
    launch_date            = Column(DateTime(timezone=True), nullable=True)
    invoice_sent_at        = Column(DateTime(timezone=True), nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())
    updated_at             = Column(DateTime(timezone=True), onupdate=func.now())