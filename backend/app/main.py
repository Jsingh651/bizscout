from fastapi import FastAPI, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import os
from app.database import engine, get_db
from app.models import Base, Lead, User, Batch, Meeting
from app.models.contract import Contract
from app.routers import leads
from app.routers import auth as auth_router
from app.routers import scrape as scrape_router
from app.routers import batches as batches_router
from app.routers import meetings as meetings_router
from app.routers import contracts as contracts_router
from app.routers import payments as payments_router
from app.models import payment
from app.routers import domains as domains_router
from app.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

Base.metadata.create_all(bind=engine)


def _run_migrations():
    """Add new columns to existing tables. Safe to run repeatedly — errors are swallowed."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)
        existing  = {col["name"] for col in inspector.get_columns("payments")}

        with engine.connect() as conn:
            if "final_invoice_token" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN final_invoice_token VARCHAR"))
                conn.commit()
                print("[migrations] added payments.final_invoice_token")

            if "final_invoice_sent_at" not in existing:
                # Use TEXT for SQLite compat; Postgres/MySQL also accept TEXT for timestamps
                conn.execute(text("ALTER TABLE payments ADD COLUMN final_invoice_sent_at TEXT"))
                conn.commit()
                print("[migrations] added payments.final_invoice_sent_at")

            if "approval_token" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN approval_token VARCHAR"))
                conn.commit()
                print("[migrations] added payments.approval_token")

            if "client_approved" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN client_approved BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print("[migrations] added payments.client_approved")

            if "client_approved_at" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN client_approved_at TEXT"))
                conn.commit()
                print("[migrations] added payments.client_approved_at")

            if "client_approved_sig" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN client_approved_sig TEXT"))
                conn.commit()
                print("[migrations] added payments.client_approved_sig")

            if "website_url" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN website_url VARCHAR"))
                conn.commit()
                print("[migrations] added payments.website_url")

            if "last_invoice_paid_at" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN last_invoice_paid_at TEXT"))
                conn.commit()
                print("[migrations] added payments.last_invoice_paid_at")

            if "next_billing_date" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN next_billing_date TEXT"))
                conn.commit()
                print("[migrations] added payments.next_billing_date")

            # Per-user ownership for the Stripe / billing flow
            if "user_id" not in existing:
                conn.execute(text("ALTER TABLE payments ADD COLUMN user_id INTEGER"))
                conn.commit()
                print("[migrations] added payments.user_id")

        # ── contracts table ──────────────────────────────────────────────
        existing_c = {col["name"] for col in inspector.get_columns("contracts")}
        with engine.connect() as conn:
            if "contract_type" not in existing_c:
                conn.execute(text("ALTER TABLE contracts ADD COLUMN contract_type VARCHAR DEFAULT 'design'"))
                conn.commit()
                print("[migrations] added contracts.contract_type")
            if "user_id" not in existing_c:
                conn.execute(text("ALTER TABLE contracts ADD COLUMN user_id INTEGER"))
                conn.commit()
                print("[migrations] added contracts.user_id")

        # ── meetings table ───────────────────────────────────────────────
        existing_m = {col["name"] for col in inspector.get_columns("meetings")}
        with engine.connect() as conn:
            if "user_id" not in existing_m:
                conn.execute(text("ALTER TABLE meetings ADD COLUMN user_id INTEGER"))
                conn.commit()
                print("[migrations] added meetings.user_id")

        # ── leads table: global archive lifecycle ────────────────────────
        existing_l = {col["name"] for col in inspector.get_columns("leads")}
        with engine.connect() as conn:
            if "is_archived" not in existing_l:
                conn.execute(text("ALTER TABLE leads ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print("[migrations] added leads.is_archived")
            if "archived_reason" not in existing_l:
                conn.execute(text("ALTER TABLE leads ADD COLUMN archived_reason VARCHAR"))
                conn.commit()
                print("[migrations] added leads.archived_reason")
    except Exception as e:
        print(f"[migrations] warning: {e}")


# Tables whose every row belongs to exactly one user. The shared ``leads`` pool
# is deliberately excluded — it is visible to everyone.
_PER_USER_TABLES = ("lead_pipeline", "contracts", "payments", "meetings")


def _setup_row_level_security():
    """
    Enable Postgres row-level security on the per-user tables.

    Each policy restricts rows to the authenticated user, identified by the
    ``app.current_user_id`` session variable that ``get_current_user`` sets on
    every request. This is a no-op on SQLite (used in local dev/tests), which
    has no RLS. App-layer ``WHERE user_id = :me`` filters remain the primary,
    test-covered guarantee; RLS is defense-in-depth for any direct DB access.
    """
    if engine.dialect.name != "postgresql":
        return
    from sqlalchemy import text
    me = "NULLIF(current_setting('app.current_user_id', true), '')::int"
    for table in _PER_USER_TABLES:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
                conn.execute(text(f"DROP POLICY IF EXISTS {table}_user_isolation ON {table}"))
                conn.execute(text(
                    f"CREATE POLICY {table}_user_isolation ON {table} "
                    f"USING (user_id = {me}) WITH CHECK (user_id = {me})"
                ))
                conn.commit()
                print(f"[rls] row-level security enabled on {table}")
        except Exception as e:
            print(f"[rls] warning on {table}: {e}")


_run_migrations()
_setup_row_level_security()

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)

# Also allow FRONTEND_URL directly so we don't rely solely on regex
_frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
_allow_origins = [_frontend_url] if _frontend_url else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(domains_router.router)

app.include_router(leads.router)
app.include_router(auth_router.router)
app.include_router(scrape_router.router)
app.include_router(batches_router.router)
app.include_router(meetings_router.router)
app.include_router(contracts_router.router)
app.include_router(payments_router.router)


# ── Stripe webhook alias ──────────────────────────────────────────────────────
# Stripe CLI forwards to /webhooks/stripe by default, but the router lives at
# /payments/webhook. This alias makes both paths work without changing the CLI.
@app.post("/webhooks/stripe")
async def stripe_webhook_alias(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    return await payments_router.stripe_webhook(request, stripe_signature, db)


@app.on_event("startup")
def _startup() -> None:
    try:
        meetings_router.start_reminder_worker()
    except Exception:
        pass


@app.get("/")
def root():
    return {"message": "BizScout API is running"}