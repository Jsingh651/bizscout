from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Numeric
from sqlalchemy.sql import func
from app.database import Base

class Contract(Base):
    __tablename__ = "contracts"

    id                  = Column(Integer, primary_key=True, index=True)
    lead_id             = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)

    # Designer info
    designer_name       = Column(String, nullable=False)
    designer_email      = Column(String, nullable=True)

    # Client info (from lead)
    client_name         = Column(String, nullable=True)
    client_email        = Column(String, nullable=True)
    client_address      = Column(String, nullable=True)

    # Contract variables
    num_pages           = Column(String, nullable=True)
    setup_price         = Column(String, nullable=True)
    monthly_price       = Column(String, nullable=True)
    timeline_weeks      = Column(String, nullable=True)
    payment_method      = Column(String, nullable=True)

    # Signing state
    designer_signed     = Column(Boolean, default=False)
    designer_signed_at  = Column(DateTime(timezone=True), nullable=True)
    designer_sig_data   = Column(Text, nullable=True)

    client_signed       = Column(Boolean, default=False)
    client_signed_at    = Column(DateTime(timezone=True), nullable=True)
    client_sig_data     = Column(Text, nullable=True)

    # Token for client signing link
    client_token        = Column(String, unique=True, index=True, nullable=True)
    token_expires_at    = Column(DateTime(timezone=True), nullable=True)

    # Audit trail
    client_ip           = Column(String, nullable=True)

    # Fully signed HTML snapshot
    signed_html         = Column(Text, nullable=True)

    # Supabase Storage URLs
    sent_pdf_url        = Column(String, nullable=True)
    final_pdf_url       = Column(String, nullable=True)

    # ── Stripe / Payment ──────────────────────────────────────────────────────
    payment_token           = Column(String, unique=True, index=True, nullable=True)
    payment_plan            = Column(String, nullable=True)   # 'full' | 'split' | None
    launch_date             = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id      = Column(String, nullable=True)
    stripe_subscription_id  = Column(String, nullable=True, index=True)
    deposit_paid            = Column(Boolean, default=False)
    final_paid              = Column(Boolean, default=False)
    invoice_sent_at         = Column(DateTime(timezone=True), nullable=True)
    monthly_discount        = Column(Numeric, nullable=True, default=10)

    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())