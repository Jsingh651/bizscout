"""
BizScout — Stripe Payments Router
Handles: send-invoice, create-session (full plan only), webhook, status, by-lead, all

Payment flow:
  1. Designer sends invoice with launch date
  2. Client pays full setup fee via Stripe Checkout (one-time charge)
  3. Stripe subscription starts on launch date for monthly hosting
"""

import os
import secrets
import stripe
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "jasonsing02@gmail.com")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _stripe():
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="Stripe not configured.")
    stripe.api_key = key
    return stripe


def _get_payment_model():
    from app.models.payment import Payment
    return Payment


def _get_contract(db, contract_id: int):
    from app.models.contract import Contract
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return c


def _get_payment_by_token(db, token: str):
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.payment_token == token).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment link not found or expired")
    return p


def _serialize(p) -> dict:
    setup   = float(p.setup_price   or 0)
    monthly = float(p.monthly_price or 0)

    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    pay_url  = f"{base_url}/pay/{p.payment_token}" if p.payment_token else None

    return {
        "id":                     p.id,
        "lead_id":                p.lead_id,
        "contract_id":            p.contract_id,
        "client_name":            p.client_name,
        "client_email":           p.client_email,
        "designer_name":          p.designer_name,
        "setup_price":            setup,
        "monthly_price":          monthly,
        "deposit_paid":           p.deposit_paid        or False,
        "deposit_paid_at":        p.deposit_paid_at.isoformat()  if p.deposit_paid_at  else None,
        "final_paid":             p.final_paid          or False,
        "final_paid_at":          p.final_paid_at.isoformat()    if p.final_paid_at    else None,
        "payment_failed":         getattr(p, "payment_failed",         False),
        "last_failed_at":         getattr(p, "last_failed_at",         None) and p.last_failed_at.isoformat(),
        "last_failure_reason":    getattr(p, "last_failure_reason",    None),
        "payment_token":          p.payment_token,
        "pay_url":                pay_url,
        "stripe_customer_id":     p.stripe_customer_id,
        "stripe_subscription_id": p.stripe_subscription_id,
        "launch_date":            p.launch_date.isoformat()      if p.launch_date      else None,
        "invoice_sent_at":        p.invoice_sent_at.isoformat()  if p.invoice_sent_at  else None,
        "created_at":             p.created_at.isoformat()       if p.created_at       else None,
    }


# ─── Email ────────────────────────────────────────────────────────────────────

def _smtp_cfg():
    return {
        "host":     os.getenv("SMTP_HOST"),
        "port":     int(os.getenv("SMTP_PORT", "587")),
        "user":     os.getenv("SMTP_USER"),
        "password": os.getenv("SMTP_PASSWORD"),
        "from":     os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER"),
    }


def _send_raw(to: str, subject: str, html: str) -> bool:
    cfg = _smtp_cfg()
    if not cfg["host"] or not cfg["user"] or not cfg["password"]:
        print("[payments] SMTP not configured — skipping email")
        return False
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = cfg["from"]
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from"], [to], msg.as_string())
        return True
    except Exception as e:
        print(f"[payments] email error: {e}")
        return False


def _invoice_html(client_name, designer_name, pay_url, setup_price, monthly_price, launch_str):
    setup_fmt   = f"${float(setup_price or 0):,.0f}"
    monthly_fmt = f"${float(monthly_price or 0):,.0f}"
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#fff;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:24px;background:#0f0f14;text-align:center;">
      <span style="font-size:18px;font-weight:800;color:#fff;">Your Website Invoice</span>
    </div>
    <div style="padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111;">Hi {client_name or 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
        <strong>{designer_name}</strong> has sent you an invoice for your new website project.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Invoice Summary</p>
        <p style="margin:0 0 6px;font-size:14px;color:#111;"><strong>Setup fee (due today):</strong> {setup_fmt}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#111;"><strong>Monthly hosting:</strong> {monthly_fmt}/mo starting {launch_str or 'on launch date'}</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Monthly billing begins automatically on your launch date via Stripe.</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="{pay_url}" style="background:#8b5cf6;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:9px;display:inline-block;">
          Pay {setup_fmt} Now
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        <a href="{pay_url}" style="color:#8b5cf6;word-break:break-all;">{pay_url}</a>
      </p>
    </div>
  </div>
</div>
</body></html>"""


def _notify_designer(payment, amount: float, event: str = "payment"):
    event_labels = {
        "payment":         "Setup Fee Received",
        "monthly_renewal": "Monthly Renewal",
    }
    label = event_labels.get(event, event)
    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#fff;">
<div style="max-width:480px;margin:40px auto;padding:0 24px;">
  <div style="background:#0f0f14;border-radius:12px;padding:24px;">
    <div style="font-size:20px;font-weight:800;color:#4ade80;margin-bottom:16px;">💰 {label}</div>
    <table style="width:100%;border-collapse:collapse;color:#e4e4e7;font-size:14px;">
      <tr><td style="padding:6px 0;color:#9ca3af;width:40%;">Client</td><td style="font-weight:600;">{payment.client_name or '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Email</td><td>{payment.client_email or '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Amount</td><td style="color:#4ade80;font-weight:800;font-size:18px;">${amount:,.2f}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Payment ID</td><td>#{payment.id}</td></tr>
    </table>
  </div>
</div>
</body></html>"""
    _send_raw(
        to=NOTIFY_EMAIL,
        subject=f"💰 {label} — {payment.client_name} (${amount:,.2f})",
        html=html,
    )


def _notify_payment_failed(payment, amount: float, reason: str):
    html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#fff;">
<div style="max-width:480px;margin:40px auto;padding:0 24px;">
  <div style="background:#0f0f14;border-radius:12px;padding:24px;">
    <div style="font-size:20px;font-weight:800;color:#f87171;margin-bottom:16px;">⚠️ Payment Failed</div>
    <table style="width:100%;border-collapse:collapse;color:#e4e4e7;font-size:14px;">
      <tr><td style="padding:6px 0;color:#9ca3af;width:40%;">Client</td><td style="font-weight:600;">{payment.client_name or '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Email</td><td>{payment.client_email or '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Amount</td><td style="color:#f87171;font-weight:800;font-size:18px;">${amount:,.2f}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Reason</td><td style="color:#fb923c;">{reason or 'Unknown'}</td></tr>
      <tr><td style="padding:6px 0;color:#9ca3af;">Payment ID</td><td>#{payment.id}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">
      Stripe will automatically retry. You may want to reach out to {payment.client_name} to update their payment method.
    </p>
  </div>
</div>
</body></html>"""
    _send_raw(
        to=NOTIFY_EMAIL,
        subject=f"⚠️ Payment failed — {payment.client_name} (${amount:,.2f})",
        html=html,
    )


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SendInvoiceRequest(BaseModel):
    contract_id: int
    launch_date: str


class CreateSessionRequest(BaseModel):
    payment_token: str
    plan:          str = "full"  # only 'full' is supported


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/send-invoice")
def send_invoice(
    body: SendInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Payment = _get_payment_model()
    c = _get_contract(db, body.contract_id)

    if not c.client_email:
        raise HTTPException(status_code=400, detail="No client email on this contract.")
    if not c.setup_price:
        raise HTTPException(status_code=400, detail="Contract must have a setup price.")

    try:
        launch_dt = datetime.fromisoformat(body.launch_date).replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid launch_date.")

    # Create or update payment record
    p = db.query(Payment).filter(Payment.contract_id == body.contract_id).first()
    if not p:
        p = Payment(
            contract_id   = c.id,
            lead_id       = c.lead_id,
            client_name   = c.client_name,
            client_email  = c.client_email,
            designer_name = c.designer_name,
            setup_price   = float(c.setup_price or 0),
            monthly_price = float(c.monthly_price or 0),
        )
        db.add(p)

    p.launch_date     = launch_dt
    p.invoice_sent_at = datetime.now(timezone.utc)
    if not p.payment_token:
        p.payment_token = secrets.token_urlsafe(32)

    # Mirror on contract
    c.launch_date     = launch_dt
    c.invoice_sent_at = datetime.now(timezone.utc)
    if not c.payment_token:
        c.payment_token = p.payment_token

    db.commit()
    db.refresh(p)

    setup_price  = float(c.setup_price or 0)
    monthly_price = float(c.monthly_price or 0)
    launch_str   = launch_dt.strftime("%B %d, %Y")
    base_url     = os.getenv("FRONTEND_URL", "http://localhost:5173")
    pay_url      = f"{base_url}/pay/{p.payment_token}"

    _send_raw(
        to=c.client_email,
        subject=f"Invoice from {c.designer_name} — Your Website Project",
        html=_invoice_html(
            client_name   = c.client_name or "there",
            designer_name = c.designer_name,
            pay_url       = pay_url,
            setup_price   = setup_price,
            monthly_price = monthly_price,
            launch_str    = launch_str,
        ),
    )

    return { **_serialize(p), "sent": True }


@router.get("/public/{token}")
def get_payment_page_data(token: str, db: Session = Depends(get_db)):
    p = _get_payment_by_token(db, token)
    return _serialize(p)


@router.post("/create-session")
def create_checkout_session(body: CreateSessionRequest, db: Session = Depends(get_db)):
    s = _stripe()
    p = _get_payment_by_token(db, body.payment_token)

    if p.deposit_paid:
        raise HTTPException(status_code=400, detail="Already paid.")

    setup   = float(p.setup_price   or 0)
    monthly = float(p.monthly_price or 0)

    base_url    = os.getenv("FRONTEND_URL", "http://localhost:5173")
    success_url = f"{base_url}/pay/{p.payment_token}?success=1"
    cancel_url  = f"{base_url}/pay/{p.payment_token}?cancelled=1"

    # Subscription trial ends on launch date so monthly billing begins then
    min_ts = int((datetime.now(timezone.utc) + timedelta(days=2, hours=1)).timestamp())
    if p.launch_date:
        launch_ts = max(
            int(datetime(p.launch_date.year, p.launch_date.month, p.launch_date.day, tzinfo=timezone.utc).timestamp()),
            min_ts
        )
    else:
        launch_ts = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())

    # One-time setup fee + monthly subscription starting on launch date
    session = s.checkout.Session.create(
        payment_method_types = ["card"],
        mode                 = "subscription",
        customer_email       = p.client_email or None,
        line_items           = [
            {
                "price_data": {
                    "currency":     "usd",
                    "unit_amount":  int(setup * 100),
                    "product_data": {"name": f"Website Design & Development — {p.client_name or 'Client'}"},
                },
                "quantity": 1,
            },
            {
                "price_data": {
                    "currency":     "usd",
                    "unit_amount":  int(monthly * 100),
                    "recurring":    {"interval": "month"},
                    "product_data": {"name": f"Website Hosting & Maintenance — {p.client_name or 'Client'}"},
                },
                "quantity": 1,
            },
        ],
        subscription_data = {
            "trial_end": launch_ts,
            "metadata":  {"payment_id": str(p.id), "plan": "full"},
        },
        metadata    = {"payment_id": str(p.id), "plan": "full"},
        success_url = success_url,
        cancel_url  = cancel_url,
    )

    p.payment_plan = "full"
    db.commit()
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    s = _stripe()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    payload = await request.body()

    if webhook_secret and stripe_signature:
        try:
            event = s.Webhook.construct_event(payload, stripe_signature, webhook_secret)
        except s.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    else:
        import json
        event = json.loads(payload)

    Payment = _get_payment_model()
    etype   = event["type"]
    data    = event["data"]["object"]

    # ── Checkout completed (setup fee paid, subscription created) ─────────────
    if etype == "checkout.session.completed":
        meta       = data.get("metadata", {})
        payment_id = int(meta.get("payment_id", 0))
        amount     = data.get("amount_total", 0) / 100

        if not payment_id:
            return {"ok": True}

        p = db.query(Payment).filter(Payment.id == payment_id).first()
        if not p:
            return {"ok": True}

        p.stripe_customer_id     = data.get("customer")
        p.stripe_subscription_id = data.get("subscription")
        p.payment_plan           = "full"
        p.deposit_paid           = True
        p.deposit_paid_at        = datetime.now(timezone.utc)
        p.final_paid             = True
        p.final_paid_at          = datetime.now(timezone.utc)
        if hasattr(p, "payment_failed"):
            p.payment_failed = False

        db.commit()
        print(f"[payments] checkout.completed payment_id={payment_id} amount=${amount}")
        try:
            _notify_designer(p, amount, "payment")
        except Exception as e:
            print(f"[payments] notify error: {e}")

    # ── Invoice paid (monthly renewal) ────────────────────────────────────────
    elif etype == "invoice.paid":
        sub_id = data.get("subscription")
        if sub_id:
            p = db.query(Payment).filter(Payment.stripe_subscription_id == sub_id).first()
            if p:
                amount = data.get("amount_paid", 0) / 100
                if hasattr(p, "payment_failed"):
                    p.payment_failed = False
                db.commit()
                print(f"[payments] invoice.paid payment_id={p.id} amount=${amount}")
                try:
                    _notify_designer(p, amount, "monthly_renewal")
                except Exception as e:
                    print(f"[payments] monthly notify error: {e}")

    # ── Invoice payment failed ────────────────────────────────────────────────
    elif etype == "invoice.payment_failed":
        sub_id = data.get("subscription")
        if sub_id:
            p = db.query(Payment).filter(Payment.stripe_subscription_id == sub_id).first()
            if p:
                amount = data.get("amount_due", 0) / 100
                reason = (data.get("last_payment_error", {}) or {}).get("message", "Card declined")

                if hasattr(p, "payment_failed"):
                    p.payment_failed      = True
                    p.last_failed_at      = datetime.now(timezone.utc)
                    p.last_failure_reason = reason
                    db.commit()

                print(f"[payments] invoice.payment_failed payment_id={p.id} amount=${amount} reason={reason}")
                try:
                    _notify_payment_failed(p, amount, reason)
                except Exception as e:
                    print(f"[payments] failed notify error: {e}")

    # ── Subscription cancelled ────────────────────────────────────────────────
    elif etype == "customer.subscription.deleted":
        sub_id = data.get("id")
        if sub_id:
            p = db.query(Payment).filter(Payment.stripe_subscription_id == sub_id).first()
            if p:
                print(f"[payments] subscription cancelled payment_id={p.id}")
                try:
                    _send_raw(
                        to      = NOTIFY_EMAIL,
                        subject = f"⚠️ Subscription cancelled — {p.client_name}",
                        html    = f"<p>Subscription for <strong>{p.client_name}</strong> (Payment #{p.id}) was cancelled in Stripe.</p>",
                    )
                except Exception:
                    pass

    return {"ok": True}


@router.get("/status/{contract_id}")
def get_payment_status_by_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.contract_id == contract_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="No payment record for this contract.")
    return _serialize(p)


@router.get("/by-lead/{lead_id}")
def get_payments_by_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Payment = _get_payment_model()
    payments = db.query(Payment).filter(Payment.lead_id == lead_id).order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]


@router.get("/all")
def get_all_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Payment = _get_payment_model()
    payments = db.query(Payment).order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]