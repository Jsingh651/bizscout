import os
import re
import secrets
import smtplib
import base64
import requests as http_requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.lead import Lead
from app.dependencies import get_current_user

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

def _smtp_cfg():
    return {
        "host":       os.getenv("SMTP_HOST"),
        "port":       int(os.getenv("SMTP_PORT", "587")),
        "user":       os.getenv("SMTP_USER"),
        "password":   os.getenv("SMTP_PASSWORD"),
        "from_email": os.getenv("FROM_EMAIL") or os.getenv("SMTP_USER"),
    }


def _send_email(to: str, subject: str, html: str, pdf_bytes: Optional[bytes] = None, pdf_filename: str = "contract.pdf"):
    cfg = _smtp_cfg()
    if not cfg["host"] or not cfg["user"] or not cfg["password"]:
        print("[contracts] SMTP not configured — skipping email")
        return False
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = cfg["from_email"]
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))
    if pdf_bytes:
        part = MIMEBase("application", "pdf", name=pdf_filename)
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
        msg.attach(part)
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"]) as server:
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from_email"], [to], msg.as_string())
        return True
    except Exception as e:
        print(f"[contracts] email error: {e}")
        return False


def _client_signing_email(designer_name: str, client_name: str, sign_url: str) -> str:
    return f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,sans-serif;background:#fff;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="padding:24px;background:#0f0f14;text-align:center;">
      <span style="font-size:18px;font-weight:800;color:#fff;">Web Design Agreement</span>
    </div>
    <div style="padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111;">Hi {client_name or 'there'},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
        <strong>{designer_name}</strong> has sent you a web design agreement to review and sign.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{sign_url}" style="background:#8b5cf6;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:9px;display:inline-block;">
          Review &amp; Sign Contract
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        <a href="{sign_url}" style="color:#8b5cf6;word-break:break-all;">{sign_url}</a>
      </p>
    </div>
  </div>
</div>
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
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    Contract = _get_contract_model()
    contracts = (
        db.query(Contract)
        .filter(Contract.lead_id == lead_id)
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