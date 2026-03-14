from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.batch import Batch
from app.models.lead import Lead

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("/")
def list_batches(db: Session = Depends(get_db)):
    """Return all batches with lead count and avg score."""
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()

    result = []
    for b in batches:
        leads = db.query(Lead).filter(Lead.batch_id == b.id).all()
        count     = len(leads)
        avg_score = round(sum(l.score or 0 for l in leads) / count, 1) if count else 0
        no_site   = sum(1 for l in leads if l.website_status == "NO WEBSITE")
        result.append({
            "id":         b.id,
            "query":      b.query,
            "location":   b.location,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "lead_count": count,
            "avg_score":  avg_score,
            "no_site":    no_site,
        })

    return result


@router.get("/{batch_id}/leads")
def get_batch_leads(batch_id: int, db: Session = Depends(get_db)):
    """Return all leads belonging to a specific batch."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    leads = (
        db.query(Lead)
        .filter(Lead.batch_id == batch_id)
        .order_by(Lead.score.desc())
        .all()
    )

    return {
        "batch": {
            "id":       batch.id,
            "query":    batch.query,
            "location": batch.location,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
        },
        "leads": [
            {
                "id":             l.id,
                "name":           l.name,
                "city":           l.city,
                "phone":          l.phone,
                "website_status": l.website_status,
                "score":          l.score,
                "pipeline_stage": l.pipeline_stage,
            }
            for l in leads
        ],
    }