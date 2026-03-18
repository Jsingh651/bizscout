import os
import re
import secrets
import base64
import requests as http_requests
from app.utils.email import send_email as _send_resend
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.lead import Lead
from app.dependencies import get_current_user
from app.utils.hashids_util import encode_id, decode_id

router = APIRouter(prefix="/contracts", tags=["contracts"])


# ─── Supabase Storage ─────────────────────────────────────────────────────────

def _supabase_upload(path: str, data: bytes, content_type: str = "application/pdf") -> Optional[str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key  = os.getenv("SUPABASE_SERVICE_KEY", "")
    bucket       = os.getenv("SUPABASE_CONTRACTS_BUCKET", "contracts")

    if not supabase_url or not service_key:
        print("[contracts] Supabase not configured — skipping upload")
        return None

    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type":  content_type,
        "x-upsert":      "true",
    }

    try:
        resp = http_requests.post(upload_url, headers=headers, data=data, timeout=30)
        if resp.status_code not in (200, 201):
            print(f"[contracts] Supabase upload error {resp.status_code}: {resp.text}")
            return None

        sign_resp = http_requests.post(
            f"{supabase_url}/storage/v1/object/sign/{bucket}/{path}",
            headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
            json={"expiresIn": 315360000},
            timeout=10,
        )
        if sign_resp.status_code == 200:
            signed = sign_resp.json().get("signedURL") or sign_resp.json().get("signedUrl", "")
            if signed:
                return f"{supabase_url}{signed}" if signed.startswith("/") else signed

        return f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"
    except Exception as e:
        print(f"[contracts] Supabase upload exception: {e}")
        return None


# ─── Email helpers ─────────────────────────────────────────────────────────────


def _send_email(to: str, subject: str, html: str, pdf_bytes: Optional[bytes] = None, pdf_filename: str = "contract.pdf"):
    return _send_resend(to, subject, html)


def _client_signing_email(designer_name: str, client_name: str, sign_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Web Design Agreement — Action Required</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <!-- Logo / Brand bar -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
      <tr>
        <td style="background:#1a1a2e;border-radius:10px;width:32px;height:32px;text-align:center;vertical-align:middle;">
          <span style="font-size:15px;font-weight:900;color:#fff;line-height:32px;display:block;">✦</span>
        </td>
        <td style="padding-left:10px;font-size:16px;font-weight:800;color:#1a1a2e;letter-spacing:-0.3px;vertical-align:middle;">{designer_name}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Main card -->
  <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04);">

    <!-- Accent top bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="height:4px;background:linear-gradient(90deg,#7c3aed,#4f46e5);font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #f0f0f5;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#ede9fe;border-radius:10px;width:44px;height:44px;text-align:center;vertical-align:middle;">
              <span style="font-size:20px;line-height:44px;display:block;">📄</span>
            </td>
            <td style="padding-left:14px;vertical-align:middle;">
              <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">Action Required</div>
              <div style="font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.5px;line-height:1.2;">Web Design Agreement</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:28px 36px;">

        <p style="margin:0 0 18px;font-size:16px;color:#111827;font-weight:600;">Hi {client_name or 'there'},</p>

        <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
          <strong style="color:#1f2937;">{designer_name}</strong> has prepared a Web Design &amp; Development Agreement for your new website project. Please review the contract carefully and add your electronic signature to get started.
        </p>

        <!-- Info box -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:12px;color:#6b7280;">Document</td>
                      <td align="right" style="font-size:12px;font-weight:600;color:#111827;">Web Design &amp; Development Agreement</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:12px;color:#6b7280;">From</td>
                      <td align="right" style="font-size:12px;font-weight:600;color:#111827;">{designer_name}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:12px;color:#6b7280;">For</td>
                      <td align="right" style="font-size:12px;font-weight:600;color:#111827;">{client_name or '—'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr><td align="center">
            <a href="{sign_url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:-0.2px;">
              Review &amp; Sign Agreement →
            </a>
          </td></tr>
        </table>

        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-align:center;">Or paste this link in your browser:</p>
        <p style="margin:0;font-size:11px;color:#7c3aed;text-align:center;word-break:break-all;">
          <a href="{sign_url}" style="color:#7c3aed;text-decoration:none;">{sign_url}</a>
        </p>

      </td></tr>
    </table>

    <!-- Footer strip -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:18px 36px;background:#fafafa;border-top:1px solid #f0f0f5;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;text-align:center;">
          This agreement was sent by <strong style="color:#6b7280;">{designer_name}</strong> via BizScout.
          If you did not expect this email, you can safely ignore it.
        </p>
      </td></tr>
    </table>

  </td></tr>
  <!-- /Main card -->

  <!-- Bottom note -->
  <tr><td style="padding:20px 0 0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Secured with 256-bit encryption &nbsp;·&nbsp; BizScout</p>
  </td></tr>

</table>
</td></tr>
</table>

</body></html>"""


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ContractCreate(BaseModel):
    lead_id:         int
    designer_name:   str
    designer_email:  Optional[str] = None
    client_email:    Optional[str] = None
    num_pages:       Optional[str] = None
    setup_price:     Optional[str] = None
    monthly_price:   Optional[str] = None
    timeline_weeks:  Optional[str] = None
    payment_method:  Optional[str] = None


class ContractSignDesigner(BaseModel):
    contract_id: int
    sig_data:    str


class ContractSignClient(BaseModel):
    token:    str
    sig_data: str


class ContractSendToClient(BaseModel):
    contract_id:  int
    html_content: Optional[str] = None


class SavePDFPayload(BaseModel):
    pdf_base64:    Optional[str] = None
    html_content:  Optional[str] = None
    client_token:  Optional[str] = None


def _upload_sig_public(path: str, png_bytes: bytes) -> Optional[str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key  = os.getenv("SUPABASE_SERVICE_KEY", "")
    bucket       = "contract-sigs"

    if not supabase_url or not service_key:
        return None

    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type":  "image/png",
        "x-upsert":      "true",
    }
    try:
        resp = http_requests.post(upload_url, headers=headers, data=png_bytes, timeout=15)
        if resp.status_code not in (200, 201):
            print(f"[contracts] sig upload error {resp.status_code}: {resp.text}")
            return None
        return f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"
    except Exception as e:
        print(f"[contracts] sig upload exception: {e}")
        return None


def _swap_sigs_for_email(html: str, contract_id: int) -> str:
    pattern = r'(data:image/png;base64,[A-Za-z0-9+/=]+)'
    matches = list(dict.fromkeys(re.findall(pattern, html)))

    labels = ['designer_sig', 'client_sig']
    for i, data_uri in enumerate(matches[:2]):
        label = labels[i] if i < len(labels) else f'sig_{i}'
        try:
            png_bytes = base64.b64decode(data_uri.split(',', 1)[1])
            url = _upload_sig_public(f'{contract_id}/{label}.png', png_bytes)
            if url:
                html = html.replace(data_uri, url)
                print(f'[contracts] swapped {label} → public URL')
            else:
                print(f'[contracts] Supabase not configured — {label} will be missing in email')
        except Exception as e:
            print(f'[contracts] sig swap error for {label}: {e}')

    return html


def _html_to_pdf(html: str) -> Optional[bytes]:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page    = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            page.wait_for_timeout(800)
            pdf_bytes = page.pdf(
                format               = "Letter",
                margin               = {"top": "0.8in", "bottom": "0.8in",
                                        "left": "0.9in", "right": "0.9in"},
                print_background     = True,
                display_header_footer = False,
            )
            browser.close()
            return pdf_bytes
    except Exception as e:
        print(f"[contracts] PDF generation error: {e}")
        return None


def _get_contract_model():
    from app.models.contract import Contract
    return Contract


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/create")
def create_contract(
    body: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    lead = db.query(Lead).filter(Lead.id == body.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    contract = Contract(
        lead_id           = body.lead_id,
        designer_name     = body.designer_name.strip(),
        designer_email    = body.designer_email,
        client_name       = lead.name,
        client_email      = body.client_email or "",
        client_address    = lead.address or lead.city or "",
        num_pages         = body.num_pages,
        setup_price       = body.setup_price,
        monthly_price     = body.monthly_price,
        timeline_weeks    = body.timeline_weeks,
        payment_method    = body.payment_method,
        client_token      = secrets.token_urlsafe(32),
        token_expires_at  = datetime.now(timezone.utc) + timedelta(hours=48),
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return {"id": contract.id, "client_token": contract.client_token}


@router.get("/by-lead/{lead_id}")
def get_contracts_for_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    real_id = decode_id(lead_id)
    if real_id is None:
        return []
    Contract = _get_contract_model()
    contracts = (
        db.query(Contract)
        .filter(Contract.lead_id == real_id)
        .order_by(Contract.created_at.desc())
        .all()
    )
    return [_serialize(c) for c in contracts]


@router.get("/all")
def get_all_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    contracts = db.query(Contract).order_by(Contract.created_at.desc()).all()
    return [_serialize(c) for c in contracts]


@router.get("/download/{contract_id}")
def download_contract_pdf(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import Response
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")

    html = getattr(c, "signed_html", None)
    if not html:
        raise HTTPException(status_code=404, detail="No signed copy available yet — contract has not been fully signed.")

    pdf_bytes = _html_to_pdf(html)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="PDF generation failed")

    safe_name = (c.client_name or "Contract").replace(" ", "_").replace(",", "").replace(".", "")
    filename  = f"Web_Design_Agreement_{safe_name}.pdf"

    return Response(
        content      = pdf_bytes,
        media_type   = "application/pdf",
        headers      = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{contract_id}")
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _serialize(c)


@router.post("/sign/designer")
def sign_designer(
    body: ContractSignDesigner,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.id == body.contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    c.designer_signed    = True
    c.designer_signed_at = datetime.now(timezone.utc)
    c.designer_sig_data  = body.sig_data
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.post("/send-to-client")
def send_to_client(
    body: ContractSendToClient,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.id == body.contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if not c.client_email:
        raise HTTPException(status_code=400, detail="No client email on this contract")

    sent_pdf_url = None
    if body.html_content:
        html_bytes   = body.html_content.encode("utf-8")
        sent_pdf_url = _supabase_upload(f"{c.id}/sent_copy.html", html_bytes, "text/html;charset=utf-8")
        if sent_pdf_url:
            c.sent_pdf_url = sent_pdf_url
            db.commit()

    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    sign_url = f"{base_url}/sign/{c.client_token}"
    html     = _client_signing_email(c.designer_name, c.client_name or "there", sign_url)
    sent     = _send_email(
        to      = c.client_email,
        subject = f"Please sign your Web Design Agreement - {c.designer_name}",
        html    = html,
    )
    return {"sent": sent, "sign_url": sign_url, "sent_pdf_url": sent_pdf_url}


@router.get("/public/{token}")
def get_contract_by_token(token: str, db: Session = Depends(get_db)):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.client_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found or link expired")
    if c.client_signed:
        return _serialize(c)
    expires = getattr(c, "token_expires_at", None)
    if expires and datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=410, detail="This signing link has expired. Please contact the designer for a new one.")
    return _serialize(c)


@router.post("/sign/client")
def sign_client(body: ContractSignClient, request: Request, db: Session = Depends(get_db)):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.client_token == body.token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Invalid signing link")
    if c.client_signed:
        raise HTTPException(status_code=400, detail="Contract already signed by client")

    expires = getattr(c, "token_expires_at", None)
    if expires and datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=410, detail="This signing link has expired. Please contact the designer for a new one.")

    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

    c.client_signed    = True
    c.client_signed_at = datetime.now(timezone.utc)
    c.client_sig_data  = body.sig_data
    c.client_ip        = client_ip
    db.commit()
    db.refresh(c)

    return _serialize(c)


@router.post("/save-pdf/{contract_id}")
def save_pdf(
    contract_id: int,
    payload: SavePDFPayload,
    db: Session = Depends(get_db),
):
    Contract = _get_contract_model()
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    if not payload.client_token or payload.client_token != c.client_token:
        raise HTTPException(status_code=403, detail="Forbidden")

    final_pdf_url = None

    if payload.html_content:
        email_ready_html = _swap_sigs_for_email(payload.html_content, contract_id)
        c.signed_html = email_ready_html
        db.commit()
    else:
        email_ready_html = None

    pdf_bytes = None
    if email_ready_html:
        print(f"[contracts] generating PDF for contract {contract_id}...")
        pdf_bytes = _html_to_pdf(email_ready_html)
        if pdf_bytes:
            print(f"[contracts] PDF generated — {len(pdf_bytes):,} bytes")
        else:
            print(f"[contracts] PDF generation failed — email will send without attachment")

    if pdf_bytes:
        final_pdf_url = _supabase_upload(
            f"{contract_id}/final_signed.pdf",
            pdf_bytes,
            "application/pdf"
        )
    elif email_ready_html:
        html_bytes    = email_ready_html.encode("utf-8")
        final_pdf_url = _supabase_upload(
            f"{contract_id}/final_signed.html",
            html_bytes,
            "text/html;charset=utf-8"
        )

    if final_pdf_url:
        c.final_pdf_url = final_pdf_url
        db.commit()

    safe_name = (c.client_name or "Contract").replace(" ", "_").replace(",", "").replace(".", "")

    email_html = c.signed_html or payload.html_content
    if not email_html:
        print(f"[contracts] No HTML available for contract {contract_id} — skipping email")
    else:
        if c.designer_email:
            _send_email(
                to           = c.designer_email,
                subject      = f"✓ Contract signed — {c.client_name or contract_id}",
                html         = email_html,
                pdf_bytes    = pdf_bytes,
                pdf_filename = f"Web_Design_Agreement_{safe_name}.pdf",
            )
        if c.client_email:
            _send_email(
                to           = c.client_email,
                subject      = f"✓ Your Signed Web Design Agreement — {c.designer_name}",
                html         = email_html,
                pdf_bytes    = pdf_bytes,
                pdf_filename = f"Web_Design_Agreement_{safe_name}.pdf",
            )

    return {"ok": True, "final_pdf_url": final_pdf_url}


# ─── Serializer ───────────────────────────────────────────────────────────────

def _serialize(c):
    return {
        "id":                     c.id,
        "lead_id":                c.lead_id,
        "lead_hid":               encode_id(c.lead_id) if c.lead_id else None,
        "designer_name":          c.designer_name,
        "designer_email":         c.designer_email,
        "client_name":            c.client_name,
        "client_email":           c.client_email,
        "client_address":         c.client_address,
        "num_pages":              c.num_pages,
        "setup_price":            c.setup_price,
        "monthly_price":          c.monthly_price,
        "timeline_weeks":         c.timeline_weeks,
        "payment_method":         c.payment_method,
        "designer_signed":        c.designer_signed,
        "designer_signed_at":     c.designer_signed_at.isoformat() if c.designer_signed_at else None,
        "designer_sig_data":      c.designer_sig_data,
        "client_signed":          c.client_signed,
        "client_signed_at":       c.client_signed_at.isoformat() if c.client_signed_at else None,
        "client_sig_data":        c.client_sig_data,
        "client_token":           c.client_token,
        "sent_pdf_url":           getattr(c, "sent_pdf_url", None),
        "final_pdf_url":          getattr(c, "final_pdf_url", None),
        "client_ip":              getattr(c, "client_ip", None),
        "token_expires_at":       c.token_expires_at.isoformat() if getattr(c, "token_expires_at", None) else None,
        "created_at":             c.created_at.isoformat() if c.created_at else None,
        # ── Payment fields ──
        "payment_token":          getattr(c, "payment_token",          None),
        "payment_plan":           getattr(c, "payment_plan",           None),
        "launch_date":            c.launch_date.isoformat() if getattr(c, "launch_date", None) else None,
        "deposit_paid":           getattr(c, "deposit_paid",           False),
        "final_paid":             getattr(c, "final_paid",             False),
        "invoice_sent_at":        c.invoice_sent_at.isoformat() if getattr(c, "invoice_sent_at", None) else None,
        "stripe_customer_id":     getattr(c, "stripe_customer_id",     None),
        "stripe_subscription_id": getattr(c, "stripe_subscription_id", None),
    }