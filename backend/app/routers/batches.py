from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.batch import Batch
from app.models.lead import Lead
from app.models.lead_pipeline import LeadPipeline
from app.models.user import User
from app.dependencies import get_current_user
from app.routers.leads import _serialize_lead
from app.utils.hashids_util import encode_id, decode_id
from app.limiter import limiter

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("/")
@limiter.limit("200/minute")
def list_batches(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all batches with lead count and avg score."""
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()
    result = []
    for b in batches:
        leads     = db.query(Lead).filter(Lead.batch_id == b.id, Lead.is_archived.isnot(True)).all()
        count     = len(leads)
        avg_score = round(sum(l.score or 0 for l in leads) / count, 1) if count else 0
        no_site   = sum(1 for l in leads if l.website_status == "NO WEBSITE")
        result.append({
            "id":         b.id,
            "hid":        encode_id(b.id),
            "query":      b.query,
            "location":   b.location,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "lead_count": count,
            "avg_score":  avg_score,
            "no_site":    no_site,
        })
    return result


@router.get("/{batch_id}/leads")
@limiter.limit("200/minute")
def get_batch_leads(request: Request, batch_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all leads belonging to a specific batch."""
    real_id = decode_id(batch_id)
    if real_id is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch = db.query(Batch).filter(Batch.id == real_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    rows = (
        db.query(Lead, LeadPipeline)
        .outerjoin(
            LeadPipeline,
            (LeadPipeline.lead_id == Lead.id) & (LeadPipeline.user_id == current_user.id),
        )
        .filter(Lead.batch_id == real_id, Lead.is_archived.isnot(True))
        .order_by(Lead.score.desc())
        .all()
    )

    return {
        "batch": {
            "id":         batch.id,
            "hid":        encode_id(batch.id),
            "query":      batch.query,
            "location":   batch.location,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
        },
        "leads": [_serialize_lead(l, p) for l, p in rows],
    }
