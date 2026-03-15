from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Cookie, Header
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.lead import Lead
from app.models.user import User
from app.services.auth import decode_token
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/leads", tags=["leads"])

_CONTRACT_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "contracts" / "service_agreement.html"


def _get_current_user(
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> User:
    token = access_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


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
def get_leads(db: Session = Depends(get_db)):
    return db.query(Lead).all()


@router.get("/{lead_id}/contract", response_class=HTMLResponse)
def get_lead_contract(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not _CONTRACT_TEMPLATE_PATH.exists():
        raise HTTPException(status_code=500, detail="Contract template not found")
    template = _CONTRACT_TEMPLATE_PATH.read_text(encoding="utf-8")
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
    html = template
    for key, value in replacements.items():
        html = html.replace(key, value)
    return HTMLResponse(html)


@router.get("/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {
        "id":                 lead.id,
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
        "pipeline_stage":     lead.pipeline_stage,
        "notes":              lead.notes,
        "call_outcome":       lead.call_outcome,
        "call_outcome_at":    lead.call_outcome_at.isoformat() if lead.call_outcome_at else None,
        "batch_id":           lead.batch_id,
    }


@router.post("/")
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    new_lead = Lead(**lead.dict())
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


@router.patch("/{lead_id}")
def update_lead(lead_id: int, body: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.pipeline_stage is not None:
        lead.pipeline_stage = body.pipeline_stage
    if body.notes is not None:
        lead.notes = body.notes
    if body.call_outcome is not None:
        lead.call_outcome = body.call_outcome
        lead.call_outcome_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead