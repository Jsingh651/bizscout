from fastapi import APIRouter, Depends, HTTPException, Cookie, Header, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.lead import Lead
from app.models.user import User
from app.models.lead_pipeline import LeadPipeline
from app.models.archive import RejectedLead, SuccessfulLead
from app.dependencies import get_current_user
from app.services.auth import decode_token
from app.utils.hashids_util import encode_id, decode_id
from app.limiter import limiter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/leads", tags=["leads"])

# ─── Global lifecycle rules ───────────────────────────────────────────────────
# A lead leaves the shared pool (for everyone) when either threshold is met.
NOT_INTERESTED   = "Not Interested"   # call outcome that counts toward rejection
CLOSED_WON       = "Closed Won"       # pipeline stage that marks a sale
REJECT_THRESHOLD = 5                  # > 5 distinct users "Not Interested" → retire


def _serialize_lead(lead: Lead, pipe: Optional[LeadPipeline]) -> dict:
    """Lead business data + the current user's private pipeline state for it."""
    return {
        "id":                 lead.id,
        "hid":                encode_id(lead.id),
        "name":               lead.name,
        "city":               lead.city,
        "phone":              lead.phone,
        "address":            lead.address,
        "website_status":     lead.website_status,
        "website_url":        lead.website_url,
        "category":           lead.category,
        "rating":             lead.rating,
        "review_count":       lead.review_count,
        "business_age_years": lead.business_age_years,
        "score":              lead.score,
        "pipeline_stage":     (pipe.pipeline_stage if pipe else None) or "New Lead",
        "notes":              pipe.notes if pipe else None,
        "call_outcome":       pipe.call_outcome if pipe else None,
        "call_outcome_at":    pipe.call_outcome_at.isoformat() if (pipe and pipe.call_outcome_at) else None,
        "batch_id":           lead.batch_id,
    }


def _get_or_create_pipeline(db: Session, user_id: int, lead_id: int) -> LeadPipeline:
    pipe = (
        db.query(LeadPipeline)
        .filter(LeadPipeline.user_id == user_id, LeadPipeline.lead_id == lead_id)
        .first()
    )
    if pipe is None:
        pipe = LeadPipeline(user_id=user_id, lead_id=lead_id, pipeline_stage="New Lead")
        db.add(pipe)
    return pipe


def _archive_lead(db: Session, lead: Lead, reason: str, **extra) -> None:
    """
    Retire a lead from the shared pool for everyone.

    Soft-archives the lead (hidden from every read) and copies a self-contained
    snapshot into rejected_leads / successful_leads. The original row is kept so
    contracts/invoices that reference it stay valid; per-user pipeline rows for
    the lead are dropped since they are no longer reachable.
    """
    snapshot = dict(
        original_lead_id=lead.id, name=lead.name, city=lead.city, phone=lead.phone,
        address=lead.address, website_status=lead.website_status, website_url=lead.website_url,
        category=lead.category, rating=lead.rating, review_count=lead.review_count,
        business_age_years=lead.business_age_years, score=lead.score, batch_id=lead.batch_id,
    )
    if reason == "rejected":
        db.add(RejectedLead(reject_count=extra.get("reject_count", 0), **snapshot))
    elif reason == "successful":
        db.add(SuccessfulLead(
            closed_by_user_id=extra.get("closed_by_user_id"),
            closed_by_email=extra.get("closed_by_email"),
            **snapshot,
        ))
    lead.is_archived = True
    lead.archived_reason = reason
    db.query(LeadPipeline).filter(LeadPipeline.lead_id == lead.id).delete(synchronize_session=False)
    db.commit()

_SERVICE_AGREEMENT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Agreement – {{lead_name}}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    .meta { font-size: 0.9rem; color: #555; margin-bottom: 32px; }
    .party { margin: 20px 0; padding: 12px 0; }
    .party strong { display: block; margin-bottom: 4px; }
    p { margin: 12px 0; text-align: justify; }
    .signature-block { margin-top: 48px; }
    .signature-line { border-bottom: 1px solid #333; width: 280px; margin-top: 36px; padding-bottom: 4px; font-size: 0.9rem; }
    .date-line { margin-top: 16px; font-size: 0.9rem; color: #555; }
  </style>
</head>
<body>
  <h1>Service Agreement</h1>
  <div class="meta">Agreement date: {{date}}</div>
  <p>This Service Agreement ("Agreement") is entered into as of <strong>{{date}}</strong> by and between:</p>
  <div class="party">
    <strong>Service Provider ("Provider")</strong>
    {{company_name}}<br />
    Represented by: {{representative_name}}
  </div>
  <div class="party">
    <strong>Client ("Client")</strong>
    {{lead_name}}<br />
    {{lead_address}}<br />
    {{lead_city}}<br />
    Phone: {{lead_phone}}<br />
    Business category: {{lead_category}}
  </div>
  <p><strong>1. Services.</strong> Provider agrees to provide services to Client as mutually agreed in separate statements of work, proposals, or orders.</p>
  <p><strong>2. Term.</strong> This Agreement is effective as of the date first written above and continues until terminated by either party with reasonable written notice.</p>
  <p><strong>3. Payment.</strong> Client agrees to pay Provider according to the terms set forth in each proposal or invoice. Unless otherwise specified, payment is due within 30 days of invoice date.</p>
  <p><strong>4. Confidentiality.</strong> Each party agrees to keep confidential any proprietary or sensitive information disclosed by the other party in connection with this Agreement.</p>
  <p><strong>5. Limitation of Liability.</strong> To the fullest extent permitted by law, Provider's total liability under this Agreement shall not exceed the fees paid by Client to Provider in the twelve (12) months preceding the claim.</p>
  <p><strong>6. General.</strong> This Agreement constitutes the entire agreement between the parties. Modifications must be in writing.</p>
  <div class="signature-block">
    <div class="signature-line"><strong>Provider:</strong> {{representative_name}}</div>
    <div class="date-line">Date: {{date}}</div>
    <div class="signature-line" style="margin-top: 32px;"><strong>Client:</strong> {{lead_name}}</div>
    <div class="date-line">Date: _________________________</div>
  </div>
</body>
</html>"""


class LeadCreate(BaseModel):
    name: str
    city: str
    phone: str
    website_status: str
    score: int
    address: Optional[str] = None
    website_url: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    business_age_years: Optional[int] = None


class LeadUpdate(BaseModel):
    pipeline_stage: Optional[str] = None
    notes: Optional[str] = None
    call_outcome: Optional[str] = None


@router.get("/")
@limiter.limit("200/minute")
def get_leads(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Shared pool (minus globally-retired leads), each row carrying THIS user's
    # private pipeline state via a left join on lead_pipeline.
    rows = (
        db.query(Lead, LeadPipeline)
        .outerjoin(
            LeadPipeline,
            (LeadPipeline.lead_id == Lead.id) & (LeadPipeline.user_id == current_user.id),
        )
        .filter(Lead.is_archived.isnot(True))
        .all()
    )
    return [_serialize_lead(lead, pipe) for lead, pipe in rows]


@router.get("/{lead_id}/contract", response_class=HTMLResponse)
def get_lead_contract(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    real_id = decode_id(lead_id)
    if real_id is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = db.query(Lead).filter(Lead.id == real_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    company_name = (current_user.full_name and current_user.full_name.strip()) or "Your Company"
    representative_name = (current_user.full_name and current_user.full_name.strip()) or current_user.email
    replacements = {
        "{{lead_name}}": (lead.name or "").strip() or "—",
        "{{lead_address}}": (lead.address or "").strip() or "—",
        "{{lead_city}}": (lead.city or "").strip() or "—",
        "{{lead_phone}}": (lead.phone or "").strip() or "—",
        "{{lead_category}}": (lead.category or "").strip() or "—",
        "{{date}}": date_str,
        "{{company_name}}": company_name,
        "{{representative_name}}": representative_name,
    }
    html = _SERVICE_AGREEMENT_HTML
    for key, value in replacements.items():
        html = html.replace(key, value)
    return HTMLResponse(html)


@router.get("/{lead_id}")
@limiter.limit("200/minute")
def get_lead(request: Request, lead_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    real_id = decode_id(lead_id)
    if real_id is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = db.query(Lead).filter(Lead.id == real_id, Lead.is_archived.isnot(True)).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    pipe = (
        db.query(LeadPipeline)
        .filter(LeadPipeline.user_id == current_user.id, LeadPipeline.lead_id == real_id)
        .first()
    )
    return _serialize_lead(lead, pipe)


@router.post("/")
@limiter.limit("200/minute")
def create_lead(request: Request, lead: LeadCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_lead = Lead(**lead.dict())
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


@router.patch("/{lead_id}")
@limiter.limit("200/minute")
def update_lead(request: Request, lead_id: str, body: LeadUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    real_id = decode_id(lead_id)
    if real_id is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = db.query(Lead).filter(Lead.id == real_id, Lead.is_archived.isnot(True)).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Update only THIS user's private pipeline state for the lead.
    pipe = _get_or_create_pipeline(db, current_user.id, real_id)
    if body.pipeline_stage is not None:
        pipe.pipeline_stage = body.pipeline_stage
    if body.notes is not None:
        pipe.notes = body.notes
    if body.call_outcome is not None:
        pipe.call_outcome = body.call_outcome
        pipe.call_outcome_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pipe)

    # ── Global lifecycle triggers ────────────────────────────────────────────
    # Sale: one user reaching "Closed Won" retires the lead for everyone.
    if body.pipeline_stage == CLOSED_WON:
        _archive_lead(db, lead, "successful",
                      closed_by_user_id=current_user.id, closed_by_email=current_user.email)
        return {"id": real_id, "hid": encode_id(real_id), "removed": True, "reason": "successful"}

    # Rejection: once more than REJECT_THRESHOLD distinct users mark the lead
    # "Not Interested", retire it for everyone. The unique (user_id, lead_id)
    # constraint means one pipeline row per user, so this count == distinct users.
    if body.call_outcome == NOT_INTERESTED:
        rejecters = (
            db.query(LeadPipeline)
            .filter(LeadPipeline.lead_id == real_id, LeadPipeline.call_outcome == NOT_INTERESTED)
            .count()
        )
        if rejecters > REJECT_THRESHOLD:
            _archive_lead(db, lead, "rejected", reject_count=rejecters)
            return {"id": real_id, "hid": encode_id(real_id), "removed": True, "reason": "rejected"}

    return _serialize_lead(lead, pipe)
