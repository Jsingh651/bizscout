from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.lead import Lead
from pydantic import BaseModel

router = APIRouter(prefix="/leads", tags=["leads"])

class LeadCreate(BaseModel):
    name: str
    city: str
    phone: str
    website_status: str
    score: int

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