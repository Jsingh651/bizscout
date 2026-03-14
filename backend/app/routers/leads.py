from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.lead import Lead
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/leads", tags=["leads"])


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


@router.get("/")
def get_leads(db: Session = Depends(get_db)):
    return db.query(Lead).all()


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
    db.commit()
    db.refresh(lead)
    return lead