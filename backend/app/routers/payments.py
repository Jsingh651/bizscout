"""
BizScout — Stripe Payments Router
Handles: send-invoice (50% deposit), send-final-invoice (50% final + monthly sub),
         create-session, webhook, status, by-lead, all

Payment flow:
  1. Designer sends Invoice 1 — client pays 50% deposit (one-time charge)
  2. Designer builds the site, then sends Invoice 2 — client pays remaining 50%
     + monthly hosting subscription that starts on the launch date
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
from app.utils.hashids_util import encode_id

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
    """Returns (payment, token_type) where token_type is 'deposit' or 'final'."""
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.payment_token == token).first()
    if p:
        return p, "deposit"
    p = db.query(Payment).filter(Payment.final_invoice_token == token).first()
    if p:
        return p, "final"
    raise HTTPException(status_code=404, detail="Payment link not found or expired")


def _serialize(p) -> dict:
    setup   = float(p.setup_price   or 0)
    monthly = float(p.monthly_price or 0)
    deposit_amount = round(setup / 2, 2)
    final_amount   = round(setup / 2, 2)

    base_url      = os.getenv("FRONTEND_URL", "http://localhost:5173")
    pay_url       = f"{base_url}/pay/{p.payment_token}"       if p.payment_token                              else None
    final_pay_url = f"{base_url}/pay/{p.final_invoice_token}" if getattr(p, "final_invoice_token", None) else None

    return {
        "id":                     p.id,
        "lead_id":                p.lead_id,
        "lead_hid":               encode_id(p.lead_id) if p.lead_id else None,
        "contract_id":            p.contract_id,
        "client_name":            p.client_name,
        "client_email":           p.client_email,
        "designer_name":          p.designer_name,
        "setup_price":            setup,
        "monthly_price":          monthly,
        "deposit_amount":         deposit_amount,
        "final_amount":           final_amount,
        "deposit_paid":           p.deposit_paid        or False,
        "deposit_paid_at":        p.deposit_paid_at.isoformat()  if p.deposit_paid_at  else None,
        "final_paid":             p.final_paid          or False,
        "final_paid_at":          p.final_paid_at.isoformat()    if p.final_paid_at    else None,
        "payment_failed":         getattr(p, "payment_failed",         False),
        "last_failed_at":         p.last_failed_at.isoformat() if getattr(p, "last_failed_at", None) else None,
        "last_failure_reason":    getattr(p, "last_failure_reason",    None),
        "payment_token":          p.payment_token,
        "final_invoice_token":    getattr(p, "final_invoice_token",    None),
        "pay_url":                pay_url,
        "final_pay_url":          final_pay_url,
        "stripe_customer_id":     p.stripe_customer_id,
        "stripe_subscription_id": p.stripe_subscription_id,
        "launch_date":            p.launch_date.isoformat()           if p.launch_date                              else None,
        "invoice_sent_at":        p.invoice_sent_at.isoformat()       if p.invoice_sent_at                          else None,
        "final_invoice_sent_at":  p.final_invoice_sent_at.isoformat() if getattr(p, "final_invoice_sent_at", None) else None,
        "payment_plan":           p.payment_plan,
        "created_at":             p.created_at.isoformat()            if p.created_at                               else None,
        "approval_token":         getattr(p, "approval_token",        None),
        "client_approved":        getattr(p, "client_approved",       False) or False,
        "client_approved_at":     (p.client_approved_at if isinstance(p.client_approved_at, str) else p.client_approved_at.isoformat()) if getattr(p, "client_approved_at", None) else None,
        "website_url":            getattr(p, "website_url",           None),
        "last_invoice_paid_at":   (p.last_invoice_paid_at if isinstance(p.last_invoice_paid_at, str) else p.last_invoice_paid_at.isoformat()) if getattr(p, "last_invoice_paid_at", None) else None,
        "next_billing_date":      (p.next_billing_date if isinstance(p.next_billing_date, str) else p.next_billing_date.isoformat()) if getattr(p, "next_billing_date", None) else None,
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


def _email_shell(accentColor: str, accentLight: str, badgeText: str, icon: str, subject_line: str, designer_name: str, client_name: str, body_rows: str, cta_url: str, cta_label: str, footer_note: str) -> str:
    """Shared professional email shell used by both invoice templates."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{subject_line}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

  <!-- Brand -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
      <tr>
        <td style="background:#1a1a2e;border-radius:10px;width:32px;height:32px;text-align:center;vertical-align:middle;">
          <span style="font-size:14px;font-weight:900;color:#fff;line-height:32px;display:block;">✦</span>
        </td>
        <td style="padding-left:10px;font-size:16px;font-weight:800;color:#1a1a2e;letter-spacing:-0.3px;vertical-align:middle;">{designer_name}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04);">

    <!-- Top accent bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:4px;background:{accentColor};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #f0f0f5;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:{accentLight};border-radius:10px;width:48px;height:48px;text-align:center;vertical-align:middle;">
              <span style="font-size:22px;line-height:48px;display:block;">{icon}</span>
            </td>
            <td style="padding-left:14px;vertical-align:middle;">
              <div style="font-size:10px;font-weight:700;color:{accentColor};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:4px;">{badgeText}</div>
              <div style="font-size:21px;font-weight:800;color:#111827;letter-spacing:-0.5px;line-height:1.2;">{subject_line}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:28px 36px 24px;">

        <p style="margin:0 0 20px;font-size:16px;color:#111827;font-weight:600;">Hi {client_name or 'there'},</p>

        {body_rows}

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;margin-bottom:16px;">
          <tr><td align="center">
            <a href="{cta_url}" style="display:inline-block;background:{accentColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 44px;border-radius:10px;letter-spacing:-0.2px;">
              {cta_label}
            </a>
          </td></tr>
        </table>

        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-align:center;">Or copy this link into your browser:</p>
        <p style="margin:0;font-size:11px;color:{accentColor};text-align:center;word-break:break-all;">
          <a href="{cta_url}" style="color:{accentColor};text-decoration:none;">{cta_url}</a>
        </p>

      </td></tr>
    </table>

    <!-- Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:18px 36px;background:#fafafa;border-top:1px solid #f0f0f5;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;text-align:center;">
          {footer_note}<br/>
          🔒&nbsp;Payments are processed securely by <strong style="color:#6b7280;">Stripe</strong>. Your card details are never stored by {designer_name}.
        </p>
      </td></tr>
    </table>

  </td></tr>

  <!-- Bottom tagline -->
  <tr><td style="padding:20px 0 0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Powered by BizScout &nbsp;·&nbsp; 256-bit SSL encryption</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""


def _invoice_line(label: str, sublabel: str, amount: str, accent: str = "#111827", is_total: bool = False) -> str:
    bg     = "#f8f7ff" if is_total else "#ffffff"
    border = "2px solid #ede9fe" if is_total else "1px solid #f0f0f5"
    return f"""
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:{bg};border:{border};border-radius:8px;margin-bottom:8px;">
          <tr><td style="padding:13px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:13px;font-weight:{'700' if is_total else '600'};color:#111827;">{label}</div>
                  {'<div style="font-size:11px;color:#6b7280;margin-top:2px;">' + sublabel + '</div>' if sublabel else ''}
                </td>
                <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:12px;">
                  <span style="font-size:{'17' if is_total else '15'}px;font-weight:800;color:{accent};">{amount}</span>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>"""


def _deposit_invoice_html(client_name, designer_name, pay_url, deposit_amount, total_setup, monthly_price, launch_str):
    deposit_fmt = f"${float(deposit_amount or 0):,.0f}"
    total_fmt   = f"${float(total_setup   or 0):,.0f}"
    monthly_fmt = f"${float(monthly_price or 0):,.0f}"

    body = f"""
        <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">
          <strong style="color:#1f2937;">{designer_name}</strong> has sent you the first invoice for your new website project.
          Once this deposit is paid, work begins immediately.
        </p>

        <!-- Section label -->
        <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Invoice Breakdown</div>

        {_invoice_line("Website Design &amp; Development — Deposit", "Invoice #1 of 2 &nbsp;·&nbsp; 50% due today to begin work", deposit_fmt, "#7c3aed", True)}
        {_invoice_line("Invoice #2 — Final Payment", "Due when your site is ready to launch &nbsp;·&nbsp; 50% remaining balance", deposit_fmt, "#6b7280")}
        {_invoice_line("Monthly Hosting &amp; Maintenance", f"Starts {launch_str or 'on your launch date'} &nbsp;·&nbsp; Billed via Invoice #2 &nbsp;·&nbsp; Cancel anytime", f"{monthly_fmt}/mo", "#059669")}

        <!-- Total due today -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;margin-bottom:4px;">
          <tr>
            <td style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Due today</td>
            <td align="right" style="font-size:22px;font-weight:900;color:#7c3aed;letter-spacing:-1px;">{deposit_fmt}</td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="height:1px;background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0;font-size:11px;color:#9ca3af;">Total project setup fee: {total_fmt}</p>
    """

    return _email_shell(
        accentColor  = "#7c3aed",
        accentLight  = "#ede9fe",
        badgeText    = "Invoice #1 of 2  ·  Deposit",
        icon         = "📋",
        subject_line = "Your Website Project Invoice",
        designer_name = designer_name,
        client_name  = client_name,
        body_rows    = body,
        cta_url      = pay_url,
        cta_label    = f"Pay Deposit {deposit_fmt} →",
        footer_note  = f"This invoice was sent by <strong style=\"color:#6b7280;\">{designer_name}</strong> for the web design project. A second invoice will be sent once your site is complete.",
    )


def _final_invoice_html(client_name, designer_name, pay_url, final_amount, monthly_price, launch_str):
    final_fmt   = f"${float(final_amount  or 0):,.0f}"
    monthly_fmt = f"${float(monthly_price or 0):,.0f}"
    total_today = float(final_amount or 0)
    total_fmt   = f"${total_today:,.0f}"

    body = f"""
        <!-- Success badge -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td style="background:#d1fae5;border-radius:8px;padding:10px 16px;">
              <span style="font-size:13px;font-weight:700;color:#065f46;">✓&nbsp; Your website is complete and ready to launch!</span>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">
          <strong style="color:#1f2937;">{designer_name}</strong> has sent your final invoice. This covers the remaining 50% of the project fee and activates your monthly hosting subscription on your launch date.
        </p>

        <!-- Section label -->
        <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Invoice Breakdown</div>

        {_invoice_line("Website Design &amp; Development — Final Payment", "Invoice #2 of 2 &nbsp;·&nbsp; Remaining 50% balance due today", final_fmt, "#059669", True)}
        {_invoice_line("Monthly Hosting &amp; Maintenance", f"Subscription begins {launch_str or 'on your launch date'} &nbsp;·&nbsp; Renews monthly &nbsp;·&nbsp; Cancel anytime with 30 days notice", f"{monthly_fmt}/mo", "#059669")}

        <!-- Total due today -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;margin-bottom:4px;">
          <tr>
            <td style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Due today</td>
            <td align="right" style="font-size:22px;font-weight:900;color:#059669;letter-spacing:-1px;">{total_fmt}</td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="height:1px;background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0;font-size:11px;color:#9ca3af;">Monthly subscription of {monthly_fmt}/mo begins on {launch_str or 'your launch date'}.</p>
    """

    return _email_shell(
        accentColor  = "#059669",
        accentLight  = "#d1fae5",
        badgeText    = "Invoice #2 of 2  ·  Final Payment",
        icon         = "🚀",
        subject_line = "Final Invoice — Your Site is Ready!",
        designer_name = designer_name,
        client_name  = client_name,
        body_rows    = body,
        cta_url      = pay_url,
        cta_label    = f"Pay {final_fmt} &amp; Launch →",
        footer_note  = f"This invoice was sent by <strong style=\"color:#6b7280;\">{designer_name}</strong>. Your monthly subscription starts on {launch_str or 'your launch date'} after payment.",
    )


def _approval_email_html(client_name, designer_name, website_url, approval_url):
    body = f"""
        <!-- Success badge -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td style="background:#d1fae5;border-radius:8px;padding:10px 16px;">
              <span style="font-size:13px;font-weight:700;color:#065f46;">✓&nbsp; Your website is ready for review!</span>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">
          <strong style="color:#1f2937;">{designer_name}</strong> has completed your website and it's ready for your review and approval.
          Please take a moment to preview the site, then sign off so we can proceed with the final billing.
        </p>

        <!-- Step 1: Preview -->
        <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Step 1 — Preview Your Website</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
          <tr><td style="padding:14px 16px;">
            <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:6px;">Your Live Website</div>
            <a href="{website_url}" style="font-size:12px;color:#059669;word-break:break-all;">{website_url}</a>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr><td align="center">
            <a href="{website_url}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 36px;border-radius:10px;letter-spacing:-0.2px;">
              Preview Your Website &rarr;
            </a>
          </td></tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr><td style="height:1px;background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>

        <!-- Step 2: Sign off -->
        <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Step 2 — Sign Off &amp; Approve</div>
        <p style="margin:0 0 16px;font-size:13px;color:#4b5563;line-height:1.7;">
          Once you're happy with the site, click below to sign the Client Satisfaction Agreement. This confirms you're satisfied with the result and authorizes final payment.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:4px;">
          <tr><td style="padding:12px 16px;">
            <p style="margin:0;font-size:12px;color:#065f46;line-height:1.7;font-style:italic;">
              "Signing confirms you're happy with the result and authorizes final payment (Invoice #2)."
            </p>
          </td></tr>
        </table>
    """

    return _email_shell(
        accentColor   = "#059669",
        accentLight   = "#d1fae5",
        badgeText     = "Website Ready for Review",
        icon          = "✅",
        subject_line  = "Your Website is Ready — Please Review &amp; Approve",
        designer_name = designer_name,
        client_name   = client_name,
        body_rows     = body,
        cta_url       = approval_url,
        cta_label     = "Sign Off &amp; Approve &rarr;",
        footer_note   = f"This approval request was sent by <strong style=\"color:#6b7280;\">{designer_name}</strong>. Signing confirms satisfaction and authorizes final billing.",
    )


def _notify_designer(payment, amount: float, event: str = "payment"):
    event_labels = {
        "deposit":         "Deposit Received (Invoice 1)",
        "final_payment":   "Final Payment Received (Invoice 2)",
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
    """Send failure alert to designer AND a grace-period warning email to the client."""
    from datetime import timedelta
    GRACE_DAYS   = 7
    deadline_dt  = datetime.now(timezone.utc) + timedelta(days=GRACE_DAYS)
    deadline_str = deadline_dt.strftime("%B %d, %Y")
    designer     = payment.designer_name or "Your Designer"
    client       = payment.client_name   or "Valued Client"
    monthly_fmt  = f"${float(payment.monthly_price or 0):,.0f}"

    # ── 1. Designer alert ──────────────────────────────────────────────────────
    designer_html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Payment Failed — {client}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="padding-bottom:20px;text-align:center;">
    <span style="font-size:16px;font-weight:800;color:#1a1a2e;">✦ BizScout</span>
  </td></tr>
  <tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="height:4px;background:linear-gradient(90deg,#ef4444,#f97316);"></div>
    <div style="padding:32px 36px;">
      <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.05em;margin-bottom:16px;">⚠ PAYMENT FAILED</div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Monthly Payment Failed</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">A monthly hosting charge for <strong style="color:#111827;">{client}</strong> was declined.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:10px;margin-bottom:24px;">
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Client</td>
            <td style="font-size:14px;font-weight:700;color:#111827;text-align:right;">{client}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Email</td>
            <td style="font-size:14px;color:#111827;text-align:right;">{payment.client_email or '—'}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Amount Failed</td>
            <td style="font-size:18px;font-weight:800;color:#ef4444;text-align:right;">${amount:,.2f}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Reason</td>
            <td style="font-size:13px;color:#f97316;font-weight:600;text-align:right;">{reason or 'Card declined'}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Grace Period Deadline</td>
            <td style="font-size:13px;font-weight:700;color:#111827;text-align:right;">{deadline_str} ({GRACE_DAYS} days)</td>
          </tr></table>
        </td></tr>
      </table>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">⚡ Client notification sent</p>
        <p style="margin:6px 0 0;font-size:12px;color:#b45309;">We've emailed {client} letting them know their payment failed and they have until <strong>{deadline_str}</strong> to update their card before their site is suspended.</p>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af;">Stripe will auto-retry the charge. If it continues to fail after the grace period, suspend the site per your agreement.</p>
    </div>
  </td></tr>
  <tr><td style="padding:20px 0;text-align:center;font-size:11px;color:#9ca3af;">BizScout · Payment Alerts</td></tr>
</table>
</td></tr></table>
</body></html>"""

    _send_raw(
        to      = NOTIFY_EMAIL,
        subject = f"⚠️ Monthly payment failed — {client} (${amount:,.2f})",
        html    = designer_html,
    )

    # ── 2. Client grace-period warning ────────────────────────────────────────
    if not payment.client_email:
        return

    # Try to create a Stripe billing portal URL for the client to update their card
    portal_url = None
    try:
        import stripe as _s
        _s.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        if payment.stripe_customer_id and _s.api_key:
            session = _s.billing_portal.Session.create(
                customer   = payment.stripe_customer_id,
                return_url = os.getenv("FRONTEND_URL", "http://localhost:5173"),
            )
            portal_url = session.url
    except Exception:
        pass

    cta_html = f"""<tr><td style="padding:24px 36px 32px;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px;padding:14px 32px;text-align:center;">
          <a href="{portal_url}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;display:block;">Update Payment Method →</a>
        </td></tr>
      </table>
    </td></tr>""" if portal_url else f"""<tr><td style="padding:0 36px 32px;font-size:13px;color:#6b7280;text-align:center;">
      Please contact <strong style="color:#111827;">{designer}</strong> to update your payment details.
    </td></tr>"""

    client_html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Action Required — Monthly Payment Failed</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="padding-bottom:20px;text-align:center;">
    <span style="font-size:16px;font-weight:800;color:#1a1a2e;">✦ {designer}</span>
  </td></tr>
  <tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="height:4px;background:linear-gradient(90deg,#ef4444,#f97316);"></div>
    <div style="padding:32px 36px 24px;">
      <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.05em;margin-bottom:16px;">⚠ ACTION REQUIRED</div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Your Payment Didn't Go Through</h2>
      <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">Hi <strong style="color:#111827;">{client}</strong>, your monthly hosting payment of <strong style="color:#ef4444;">{monthly_fmt}/mo</strong> was declined.</p>
    </div>

    <div style="padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:10px;">
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Amount Due</td>
            <td style="font-size:18px;font-weight:800;color:#ef4444;text-align:right;">${amount:,.2f}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;border-bottom:1px solid #f3f4f6;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Reason</td>
            <td style="font-size:13px;color:#f97316;font-weight:600;text-align:right;">{reason or 'Card declined'}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 18px;">
          <table width="100%"><tr>
            <td style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Resolve By</td>
            <td style="font-size:13px;font-weight:800;color:#dc2626;text-align:right;">{deadline_str}</td>
          </tr></table>
        </td></tr>
      </table>
    </div>

    <div style="padding:0 36px 24px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚡ You have {GRACE_DAYS} days to resolve this</p>
        <p style="margin:8px 0 0;font-size:12px;color:#b45309;line-height:1.6;">
          Per your web design agreement, if payment is not resolved by <strong>{deadline_str}</strong>,
          your website will be temporarily suspended until the balance is settled.
          Stripe will automatically retry your card in the meantime.
        </p>
      </div>
    </div>

    {cta_html}

    <div style="border-top:1px solid #f3f4f6;padding:20px 36px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Questions? Reply to this email or contact <strong style="color:#6b7280;">{designer}</strong>.</p>
    </div>
  </td></tr>
  <tr><td style="padding:20px 0;text-align:center;font-size:11px;color:#9ca3af;">
    Powered by BizScout &nbsp;·&nbsp; You're receiving this because you have an active hosting subscription.
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    _send_raw(
        to      = payment.client_email,
        subject = f"⚠️ Action required: Your hosting payment failed — resolve by {deadline_str}",
        html    = client_html,
    )


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SendInvoiceRequest(BaseModel):
    contract_id: int
    launch_date: str


class SendFinalInvoiceRequest(BaseModel):
    contract_id: int


class CreateSessionRequest(BaseModel):
    payment_token: str


class SendApprovalRequest(BaseModel):
    contract_id: int
    website_url: str


class ApproveRequest(BaseModel):
    signature: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/send-invoice")
def send_invoice(
    body: SendInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send Invoice #1: 50% deposit. Creates the payment record with plan='split'."""
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
    p.payment_plan    = "split"
    if not p.payment_token:
        p.payment_token = secrets.token_urlsafe(32)

    c.launch_date     = launch_dt
    c.invoice_sent_at = datetime.now(timezone.utc)
    c.payment_plan    = "split"
    if not c.payment_token:
        c.payment_token = p.payment_token

    db.commit()
    db.refresh(p)

    setup_price    = float(c.setup_price or 0)
    monthly_price  = float(c.monthly_price or 0)
    deposit_amount = round(setup_price / 2, 2)
    launch_str     = launch_dt.strftime("%B %d, %Y")
    base_url       = os.getenv("FRONTEND_URL", "http://localhost:5173")
    pay_url        = f"{base_url}/pay/{p.payment_token}"

    _send_raw(
        to      = c.client_email,
        subject = f"Invoice #1 of 2 from {c.designer_name} — 50% Deposit",
        html    = _deposit_invoice_html(
            client_name    = c.client_name or "there",
            designer_name  = c.designer_name,
            pay_url        = pay_url,
            deposit_amount = deposit_amount,
            total_setup    = setup_price,
            monthly_price  = monthly_price,
            launch_str     = launch_str,
        ),
    )

    return {**_serialize(p), "sent": True}


@router.post("/send-final-invoice")
def send_final_invoice(
    body: SendFinalInvoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send Invoice #2: remaining 50% + monthly subscription starting on launch date."""
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.contract_id == body.contract_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="No payment record found for this contract.")
    if not p.deposit_paid:
        raise HTTPException(status_code=400, detail="Deposit (Invoice #1) must be paid before sending the final invoice.")
    if p.final_paid:
        raise HTTPException(status_code=400, detail="Final payment has already been made.")

    if not getattr(p, "final_invoice_token", None):
        p.final_invoice_token = secrets.token_urlsafe(32)

    p.final_invoice_sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)

    final_amount  = round(float(p.setup_price or 0) / 2, 2)
    monthly_price = float(p.monthly_price or 0)
    launch_str    = p.launch_date.strftime("%B %d, %Y") if p.launch_date else "TBD"
    base_url      = os.getenv("FRONTEND_URL", "http://localhost:5173")
    final_pay_url = f"{base_url}/pay/{p.final_invoice_token}"

    _send_raw(
        to      = p.client_email,
        subject = f"Invoice #2 of 2 from {p.designer_name} — Final Payment + Monthly Hosting",
        html    = _final_invoice_html(
            client_name   = p.client_name or "there",
            designer_name = p.designer_name,
            pay_url       = final_pay_url,
            final_amount  = final_amount,
            monthly_price = monthly_price,
            launch_str    = launch_str,
        ),
    )

    return {**_serialize(p), "sent": True, "final_pay_url": final_pay_url}


@router.get("/public/{token}")
def get_payment_page_data(token: str, db: Session = Depends(get_db)):
    p, token_type = _get_payment_by_token(db, token)
    return {**_serialize(p), "token_type": token_type}


@router.post("/create-session")
def create_checkout_session(body: CreateSessionRequest, db: Session = Depends(get_db)):
    s = _stripe()
    p, token_type = _get_payment_by_token(db, body.payment_token)

    base_url    = os.getenv("FRONTEND_URL", "http://localhost:5173")
    success_url = f"{base_url}/pay/{body.payment_token}?success=1"
    cancel_url  = f"{base_url}/pay/{body.payment_token}?cancelled=1"

    setup         = float(p.setup_price   or 0)
    monthly       = float(p.monthly_price or 0)
    deposit_amount = round(setup / 2, 2)
    final_amount   = round(setup / 2, 2)

    if token_type == "deposit":
        if p.deposit_paid:
            raise HTTPException(status_code=400, detail="Deposit already paid.")

        launch_str = p.launch_date.strftime("%B %d, %Y") if p.launch_date else "TBD"

        # One-time deposit payment — no subscription yet
        # Split deposit into two line items so Stripe left panel shows a detailed breakdown
        design_amt = round(deposit_amount * 0.5, 2)
        dev_amt    = deposit_amount - design_amt  # avoids rounding drift

        session = s.checkout.Session.create(
            payment_method_types        = ["card"],
            mode                        = "payment",
            customer_email              = p.client_email or None,
            billing_address_collection  = "required",
            phone_number_collection     = {"enabled": True},
            line_items = [
                {
                    "price_data": {
                        "currency":    "usd",
                        "unit_amount": int(design_amt * 100),
                        "product_data": {
                            "name":        "Custom Website Design",
                            "description": (
                                f"Wireframes, visual design, branding, and UI/UX for {p.client_name or 'your site'}. "
                                f"By {p.designer_name or 'your designer'}. Part of your 50% deposit (Invoice #1 of 2)."
                            ),
                        },
                    },
                    "quantity": 1,
                },
                {
                    "price_data": {
                        "currency":    "usd",
                        "unit_amount": int(dev_amt * 100),
                        "product_data": {
                            "name":        "Custom Website Development",
                            "description": (
                                f"Full build, integrations, revisions, testing, and launch preparation. "
                                f"Planned launch: {launch_str}. Final invoice follows when site is ready."
                            ),
                        },
                    },
                    "quantity": 1,
                },
            ],
            custom_text = {
                "submit": {
                    "message": (
                        f"Paying ${deposit_amount:,.0f} today secures your project slot. "
                        f"Work begins immediately. A second invoice for the remaining ${deposit_amount:,.0f} "
                        f"+ monthly hosting will be sent when your site is ready."
                    ),
                },
            },
            payment_intent_data = {
                "description": f"Website deposit for {p.client_name or 'Client'} — Invoice #1 of 2 (by {p.designer_name})",
                "metadata":    {"payment_id": str(p.id), "plan": "split_deposit", "client": p.client_name or ""},
            },
            metadata    = {"payment_id": str(p.id), "plan": "split_deposit"},
            success_url = success_url,
            cancel_url  = cancel_url,
        )

    else:  # final
        if p.final_paid:
            raise HTTPException(status_code=400, detail="Final payment already made.")
        if not p.deposit_paid:
            raise HTTPException(status_code=400, detail="Deposit must be paid first.")

        # Compute launch timestamp (subscription trial ends on launch date)
        min_ts = int((datetime.now(timezone.utc) + timedelta(days=2, hours=1)).timestamp())
        if p.launch_date:
            launch_ts = max(
                int(datetime(p.launch_date.year, p.launch_date.month, p.launch_date.day, tzinfo=timezone.utc).timestamp()),
                min_ts,
            )
        else:
            launch_ts = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())

        launch_str_final = p.launch_date.strftime("%B %d, %Y") if p.launch_date else "TBD"

        # Final payment: remaining 50% + monthly subscription starting on launch date
        session = s.checkout.Session.create(
            payment_method_types       = ["card"],
            mode                       = "subscription",
            customer                   = p.stripe_customer_id or None,
            customer_email             = p.client_email if not p.stripe_customer_id else None,
            billing_address_collection = "required",
            phone_number_collection    = {"enabled": True},
            line_items = [
                {
                    "price_data": {
                        "currency":     "usd",
                        "unit_amount":  int(final_amount * 100),
                        "product_data": {
                            "name": f"Website Final Payment — {p.client_name or 'Client'} (Invoice #2 of 2)",
                            "description": (
                                f"Remaining 50% balance. Your website is complete and ready to launch! "
                                f"Designed & developed by {p.designer_name or 'your designer'}. "
                                f"Includes all agreed revisions and launch support."
                            ),
                        },
                    },
                    "quantity": 1,
                },
                {
                    "price_data": {
                        "currency":     "usd",
                        "unit_amount":  int(monthly * 100),
                        "recurring":    {"interval": "month"},
                        "product_data": {
                            "name":        "Website Hosting & Maintenance",
                            "description": (
                                f"Monthly hosting, SSL certificate, security updates, uptime monitoring, "
                                f"and priority support. Managed by {p.designer_name or 'your designer'}. "
                                f"Subscription begins {launch_str_final}. Cancel anytime with 30 days notice."
                            ),
                        },
                    },
                    "quantity": 1,
                },
            ],
            custom_text = {
                "submit": {
                    "message": (
                        f"Your deposit has already been applied. This covers the remaining balance "
                        f"and activates your monthly hosting subscription on {launch_str_final}."
                    ),
                },
                "after_submit": {
                    "message": (
                        f"Monthly billing of ${monthly:,.0f}/mo begins on {launch_str_final}. "
                        f"You can cancel anytime with 30 days notice."
                    ),
                },
            },
            subscription_data = {
                "trial_end": launch_ts,
                "metadata":  {"payment_id": str(p.id), "plan": "split_final"},
            },
            metadata    = {"payment_id": str(p.id), "plan": "split_final"},
            success_url = success_url,
            cancel_url  = cancel_url,
        )

    p.payment_plan = "split"
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

    # ── Checkout completed ────────────────────────────────────────────────────
    if etype == "checkout.session.completed":
        meta       = data.get("metadata", {})
        payment_id = int(meta.get("payment_id", 0))
        plan       = meta.get("plan", "")
        amount     = data.get("amount_total", 0) / 100

        if not payment_id:
            return {"ok": True}

        p = db.query(Payment).filter(Payment.id == payment_id).first()
        if not p:
            return {"ok": True}

        if plan == "split_deposit":
            p.stripe_customer_id = data.get("customer") or p.stripe_customer_id
            p.deposit_paid       = True
            p.deposit_paid_at    = datetime.now(timezone.utc)
            if hasattr(p, "payment_failed"):
                p.payment_failed = False
            db.commit()
            print(f"[payments] deposit paid payment_id={payment_id} amount=${amount}")
            try:
                _notify_designer(p, amount, "deposit")
            except Exception as e:
                print(f"[payments] notify error: {e}")

        elif plan == "split_final":
            now = datetime.now(timezone.utc)
            p.stripe_customer_id     = data.get("customer") or p.stripe_customer_id
            p.stripe_subscription_id = data.get("subscription") or p.stripe_subscription_id
            p.final_paid             = True
            p.final_paid_at          = now
            if hasattr(p, "payment_failed"):
                p.payment_failed = False
            # initial invoice.paid fires before this event — set billing dates now
            if hasattr(p, "last_invoice_paid_at") and not p.last_invoice_paid_at:
                p.last_invoice_paid_at = now
            if hasattr(p, "next_billing_date") and not p.next_billing_date:
                from datetime import timedelta
                # next billing is ~1 month from launch date (or today if no launch date)
                base = p.launch_date if p.launch_date else now
                p.next_billing_date = base.replace(tzinfo=timezone.utc) + timedelta(days=30)
            db.commit()
            print(f"[payments] final payment paid payment_id={payment_id} amount=${amount}")
            try:
                _notify_designer(p, amount, "final_payment")
            except Exception as e:
                print(f"[payments] notify error: {e}")

        else:
            # Legacy 'full' plan fallback
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
            try:
                _notify_designer(p, amount, "deposit")
            except Exception as e:
                print(f"[payments] notify error: {e}")

    # ── Invoice paid (monthly renewal) ────────────────────────────────────────
    elif etype == "invoice.paid":
        sub_id = data.get("subscription")
        if sub_id:
            p = db.query(Payment).filter(Payment.stripe_subscription_id == sub_id).first()
            if p:
                amount = data.get("amount_paid", 0) / 100
                now    = datetime.now(timezone.utc)
                if hasattr(p, "payment_failed"):
                    p.payment_failed = False
                # Track last paid + next billing date (period_end from Stripe is next cycle start)
                if hasattr(p, "last_invoice_paid_at"):
                    p.last_invoice_paid_at = now
                if hasattr(p, "next_billing_date"):
                    period_end = data.get("period_end")  # Unix timestamp
                    if period_end:
                        p.next_billing_date = datetime.fromtimestamp(period_end, tz=timezone.utc)
                    else:
                        from datetime import timedelta
                        p.next_billing_date = now + timedelta(days=30)
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


@router.post("/sync-status/{contract_id}")
def sync_payment_status(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check Stripe for completed sessions and sync deposit_paid / final_paid into the DB.
    Useful when the webhook didn't fire (e.g. local dev without Stripe CLI)."""
    s = _stripe()
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.contract_id == contract_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="No payment record for this contract.")

    changed = False

    # ── Check deposit ────────────────────────────────────────────────────────
    if not p.deposit_paid and p.payment_token:
        sessions = s.checkout.Session.list(limit=20)
        for sess in sessions.auto_paging_iter():
            meta = sess.get("metadata") or {}
            if str(meta.get("payment_id")) == str(p.id) and meta.get("plan") == "split_deposit":
                if sess.get("payment_status") == "paid":
                    p.deposit_paid    = True
                    p.deposit_paid_at = datetime.now(timezone.utc)
                    if sess.get("customer"):
                        p.stripe_customer_id = sess["customer"]
                    if hasattr(p, "payment_failed"):
                        p.payment_failed = False
                    changed = True
                break

    # ── Check final ──────────────────────────────────────────────────────────
    if not p.final_paid and getattr(p, "final_invoice_token", None):
        sessions = s.checkout.Session.list(limit=20)
        for sess in sessions.auto_paging_iter():
            meta = sess.get("metadata") or {}
            if str(meta.get("payment_id")) == str(p.id) and meta.get("plan") == "split_final":
                if sess.get("payment_status") == "paid" or sess.get("status") == "complete":
                    p.final_paid    = True
                    p.final_paid_at = datetime.now(timezone.utc)
                    if sess.get("subscription"):
                        p.stripe_subscription_id = sess["subscription"]
                    if hasattr(p, "payment_failed"):
                        p.payment_failed = False
                    changed = True
                break

    if changed:
        db.commit()

    return {**_serialize(p), "synced": changed}


@router.get("/all")
def get_all_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Payment = _get_payment_model()
    payments = db.query(Payment).order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]


# ─── Client Approval Flow ─────────────────────────────────────────────────────

@router.post("/send-approval")
def send_approval(
    body: SendApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a client approval email with a website preview link and a sign-off link."""
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.contract_id == body.contract_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="No payment record for this contract.")
    if not p.deposit_paid:
        raise HTTPException(status_code=400, detail="Deposit must be paid before sending for approval.")

    p.website_url = body.website_url

    if not getattr(p, "approval_token", None):
        p.approval_token = secrets.token_urlsafe(32)

    db.commit()
    db.refresh(p)

    base_url     = os.getenv("FRONTEND_URL", "http://localhost:5173")
    approval_url = f"{base_url}/approve/{p.approval_token}"

    html = _approval_email_html(
        client_name   = p.client_name   or "there",
        designer_name = p.designer_name or "Your Designer",
        website_url   = body.website_url,
        approval_url  = approval_url,
    )

    _send_raw(
        to      = p.client_email,
        subject = f"Your Website is Ready — Please Review & Approve | {p.designer_name or 'Your Designer'}",
        html    = html,
    )

    return _serialize(p)


@router.get("/approval/{token}")
def get_approval_info(token: str, db: Session = Depends(get_db)):
    """Public endpoint — returns approval page data for a given token."""
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.approval_token == token).first()
    if not p:
        raise HTTPException(status_code=404, detail="Approval link not found or expired.")
    return {
        "payment_id":          p.id,
        "contract_id":         p.contract_id,
        "client_name":         p.client_name,
        "designer_name":       p.designer_name,
        "website_url":         getattr(p, "website_url", None),
        "client_approved":     getattr(p, "client_approved", False) or False,
        "client_approved_at":  (p.client_approved_at if isinstance(p.client_approved_at, str) else p.client_approved_at.isoformat()) if getattr(p, "client_approved_at", None) else None,
    }


@router.post("/approve/{token}")
def approve_site(token: str, body: ApproveRequest, db: Session = Depends(get_db)):
    """Public endpoint — client submits their signature to approve the site."""
    Payment = _get_payment_model()
    p = db.query(Payment).filter(Payment.approval_token == token).first()
    if not p:
        raise HTTPException(status_code=404, detail="Approval link not found or expired.")

    now = datetime.now(timezone.utc)
    p.client_approved     = True
    p.client_approved_at  = now
    p.client_approved_sig = body.signature
    db.commit()

    # ── Save satisfaction agreement as a Contract record ──────────────
    if p.lead_id:
        from app.models.contract import Contract
        date_str    = now.strftime("%B %d, %Y")
        website_url = getattr(p, "website_url", None) or ""
        signed_html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{{font-family:'Times New Roman',serif;font-size:11.5pt;line-height:1.75;color:#1a1a2e;max-width:780px;margin:0 auto;padding:60px 80px;}}
  h1{{font-size:15pt;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:2px solid #1a1a2e;padding-bottom:16px;margin-bottom:24px;}}
  .sub{{text-align:center;font-size:9pt;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:32px;}}
  .banner{{background:#f0fdf4;border:1.5px solid #86efac;border-radius:4px;padding:10px 16px;margin-bottom:28px;text-align:center;font-size:9pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#166534;}}
  table{{width:100%;border-collapse:collapse;margin:16px 0;}}
  td{{padding:8px 12px;border:1px solid #ccc;font-size:11pt;}}
  td:first-child{{background:#fafafa;font-weight:600;width:35%;}}
  .sig-area{{margin-top:40px;}}
  .sig-label{{font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px;display:block;}}
  .sig-line{{border-bottom:1.5px solid #1a1a2e;margin-bottom:6px;}}
  .footer{{margin-top:40px;padding-top:12px;border-top:1px solid #ccc;font-size:8pt;color:#888;text-align:center;}}
</style></head><body>
<h1>Client Satisfaction &amp; Final Payment Agreement</h1>
<div class="sub">Reference: WDA-{p.contract_id or 'N/A'} — Satisfaction Agreement</div>
<div class="banner">✓ Signed &amp; Executed — {date_str}</div>
<p>By signing this agreement, the Client confirms the following:</p>
<table>
  <tr><td>Designer</td><td>{p.designer_name or '—'}</td></tr>
  <tr><td>Client</td><td>{p.client_name or '—'}</td></tr>
  <tr><td>Website Reviewed</td><td><a href="{website_url}">{website_url}</a></td></tr>
  <tr><td>Date Signed</td><td>{date_str}</td></tr>
</table>
<ol style="margin:16px 0 16px 24px;font-size:11pt;line-height:1.75;">
  <li>Client has reviewed the completed website at the URL above.</li>
  <li>Client is satisfied with the design, layout, and functionality of the website.</li>
  <li>Client authorizes {p.designer_name or 'Designer'} to issue Invoice #2 for the remaining balance.</li>
  <li>Client waives any right to dispute the quality or completeness of the design work reviewed above.</li>
</ol>
<div class="sig-area">
  <span class="sig-label">Client Signature</span>
  <div style="min-height:64px;margin-bottom:6px;display:flex;align-items:flex-end;">
    <img src="{body.signature}" style="height:56px;max-width:220px;display:block;" alt="Client signature"/>
  </div>
  <div class="sig-line"></div>
  <div style="font-size:10pt;font-weight:700;">{p.client_name or '—'}</div>
  <div style="font-size:9pt;color:#555;">Date: {date_str}</div>
</div>
<div class="footer">
  Client Satisfaction Agreement | {p.designer_name or 'Designer'} &amp; {p.client_name or 'Client'} | {date_str}<br/>
  This document is legally binding under California UETA and the federal E-SIGN Act.
</div>
</body></html>"""

        satisfaction = Contract(
            lead_id          = p.lead_id,
            designer_name    = p.designer_name or "",
            designer_email   = "",
            client_name      = p.client_name,
            client_email     = p.client_email,
            contract_type    = "satisfaction",
            designer_signed  = True,
            designer_signed_at = now,
            client_signed    = True,
            client_signed_at = now,
            client_sig_data  = body.signature,
            signed_html      = signed_html,
        )
        db.add(satisfaction)
        db.commit()

    # ── Confirmation emails ───────────────────────────────────────────
    date_str    = now.strftime("%B %d, %Y at %I:%M %p UTC")
    website_url = getattr(p, "website_url", None) or "N/A"

    confirm_html = f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#059669;padding:4px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 40px 24px;text-align:center;">
    <div style="font-size:28px;margin-bottom:8px;">✅</div>
    <div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Website Approved</div>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">Client Satisfaction Confirmed</h1>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
      This email confirms that <strong style="color:#111827;">{p.client_name or 'the client'}</strong> has reviewed and approved the completed website on <strong>{date_str}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px;">Client</td><td style="font-size:12px;color:#111827;font-weight:600;text-align:right;">{p.client_name or '—'}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px;">Designer</td><td style="font-size:12px;color:#111827;font-weight:600;text-align:right;">{p.designer_name or '—'}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;padding-bottom:6px;">Website</td><td style="font-size:12px;color:#059669;text-align:right;"><a href="{website_url}" style="color:#059669;">{website_url}</a></td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Signed</td><td style="font-size:12px;color:#111827;font-weight:600;text-align:right;">{date_str}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">
      By signing the Client Satisfaction Agreement, the client confirmed they are satisfied with the design, layout, and functionality, and authorized final billing (Invoice #2). This record is stored and legally binding under California UETA and the federal E-SIGN Act.
    </p>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <div style="font-size:11px;color:#9ca3af;">BizScout &nbsp;·&nbsp; Secured with 256-bit encryption</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>"""

    # Send to client
    try:
        if p.client_email:
            _send_raw(
                to      = p.client_email,
                subject = f"✅ Website Approval Confirmed — {p.client_name or 'Your Website'}",
                html    = confirm_html,
            )
    except Exception as e:
        print(f"[payments] approval confirm email to client failed: {e}")

    # Send to designer
    try:
        _send_raw(
            to      = NOTIFY_EMAIL,
            subject = f"✅ Client Approved Website — {p.client_name or 'Client'} ({date_str})",
            html    = confirm_html,
        )
    except Exception as e:
        print(f"[payments] approval confirm email to designer failed: {e}")

    return {"ok": True}
