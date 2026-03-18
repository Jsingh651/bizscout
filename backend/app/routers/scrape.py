import subprocess
import sys
import os
import csv
import re
import uuid
import time
import tempfile
import threading
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db, DATABASE_URL
from app.models.lead import Lead
from app.models.batch import Batch
from app.models.user import User
from app.dependencies import get_current_user
from app.limiter import limiter

router = APIRouter(prefix="/scrape", tags=["scrape"])

jobs: dict[str, dict] = {}


class ScrapeRequest(BaseModel):
    query: str
    location: str
    no_website_only: bool = False


# ─── URGENCY KEYWORDS ─────────────────────────────────────────────────────────

HIGH_URGENCY_KEYWORDS = {
    "restaurant", "food truck", "cafe", "bakery", "pizza", "sushi", "mexican",
    "chinese", "thai", "indian", "italian", "burger", "sandwich", "catering",
    "auto repair", "auto body", "mechanic", "plumber", "plumbing", "hvac",
    "roofing", "roofer", "landscaping", "lawn care", "electrician", "contractor",
    "hair salon", "barbershop", "barber", "nail salon", "spa", "massage",
    "dentist", "chiropractor", "veterinarian", "vet", "pet grooming",
    "cleaning", "pest control", "tree service", "painter", "handyman",
}

MEDIUM_URGENCY_KEYWORDS = {
    "gym", "fitness", "yoga", "pilates", "martial arts", "dance",
    "accountant", "tax", "insurance", "real estate", "florist",
    "photographer", "videographer", "printing", "locksmith",
    "dry cleaner", "tailor", "shoe repair", "laundry",
}


def _category_score(category: str, query: str) -> int:
    text = f"{(category or '').lower()} {(query or '').lower()}"
    for kw in HIGH_URGENCY_KEYWORDS:
        if kw in text:
            return 10
    for kw in MEDIUM_URGENCY_KEYWORDS:
        if kw in text:
            return 5
    return 0


def score_lead(row: dict, query: str = "") -> int:
    score = 0

    has_website = row.get("has_website", "").strip().lower()
    if has_website == "no":
        score += 35

    try:
        rating = float(row.get("rating") or 0)
        if rating >= 4.8:   score += 20
        elif rating >= 4.5: score += 14
        elif rating >= 4.0: score += 8
        elif rating >= 3.5: score += 3
    except (ValueError, TypeError):
        pass

    try:
        rc = int(row.get("review_count") or 0)
        if rc >= 200:   score += 15
        elif rc >= 100: score += 12
        elif rc >= 50:  score += 8
        elif rc >= 20:  score += 4
    except (ValueError, TypeError):
        pass

    try:
        age = int(row.get("business_age_years") or 0)
        if age >= 7:   score += 12
        elif age >= 5: score += 9
        elif age >= 3: score += 6
        elif age >= 1: score += 3
    except (ValueError, TypeError):
        pass

    score += _category_score(row.get("category", ""), query)

    if row.get("phone", "").strip():
        score += 4
    if row.get("address", "").strip():
        score += 4

    return min(score, 100)


def score_breakdown(row: dict, query: str = "") -> dict:
    breakdown = {}

    has_website = row.get("has_website", "").strip().lower()
    breakdown["no_website"] = 35 if has_website == "no" else 0

    try:
        rating = float(row.get("rating") or 0)
        if rating >= 4.8:   breakdown["rating"] = 20
        elif rating >= 4.5: breakdown["rating"] = 14
        elif rating >= 4.0: breakdown["rating"] = 8
        elif rating >= 3.5: breakdown["rating"] = 3
        else:               breakdown["rating"] = 0
    except (ValueError, TypeError):
        breakdown["rating"] = 0

    try:
        rc = int(row.get("review_count") or 0)
        if rc >= 200:   breakdown["review_count"] = 15
        elif rc >= 100: breakdown["review_count"] = 12
        elif rc >= 50:  breakdown["review_count"] = 8
        elif rc >= 20:  breakdown["review_count"] = 4
        else:           breakdown["review_count"] = 0
    except (ValueError, TypeError):
        breakdown["review_count"] = 0

    try:
        age = int(row.get("business_age_years") or 0)
        if age >= 7:   breakdown["business_age"] = 12
        elif age >= 5: breakdown["business_age"] = 9
        elif age >= 3: breakdown["business_age"] = 6
        elif age >= 1: breakdown["business_age"] = 3
        else:          breakdown["business_age"] = 0
    except (ValueError, TypeError):
        breakdown["business_age"] = 0

    breakdown["category"] = _category_score(row.get("category", ""), query)
    breakdown["phone"]    = 4 if row.get("phone", "").strip() else 0
    breakdown["address"]  = 4 if row.get("address", "").strip() else 0

    return breakdown


def _find_or_create_batch(db, query: str, location: str) -> int:
    q = query.strip().lower()
    l = location.strip().lower()
    existing = (
        db.query(Batch)
        .filter(Batch.query.ilike(q), Batch.location.ilike(l))
        .order_by(Batch.created_at.desc())
        .first()
    )
    if existing:
        return existing.id
    batch = Batch(query=query.strip(), location=location.strip())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch.id


def watch_csv_for_new_rows(job_id: str, csv_path: str, stop_event: threading.Event):
    seen_names: set = set()
    start_time = time.time()
    query = jobs[job_id].get("query", "")

    while not stop_event.is_set():
        if not os.path.exists(csv_path):
            time.sleep(0.5)
            continue

        try:
            with open(csv_path, newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
        except Exception:
            time.sleep(0.5)
            continue

        for row in rows:
            name = (row.get("name") or "").strip()
            if not name or name in seen_names:
                continue
            seen_names.add(name)
            jobs[job_id]["found_companies"].append({
                "name":               name,
                "phone":              row.get("phone", ""),
                "has_website":        row.get("has_website", "no").strip().lower() == "yes",
                "rating":             row.get("rating", ""),
                "review_count":       row.get("review_count", 0),
                "business_age_years": row.get("business_age_years", 0),
                "score":              score_lead(row, query),
            })
            jobs[job_id]["found_count"] = len(jobs[job_id]["found_companies"])

        elapsed = time.time() - start_time
        total = jobs[job_id]["found_count"]
        if total > 1 and elapsed > 3:
            rate = total / elapsed
            estimated_total = max(total + max(3, int(rate * 10)), 15)
            remaining = (estimated_total - total) / rate if rate > 0 else 60
            remaining = min(max(int(remaining), 3), 180)
            jobs[job_id]["eta_seconds"] = remaining

        if jobs[job_id].get("status") in ("done", "error", "stopped"):
            break

        time.sleep(0.7)


def _save_results(job_id: str, csv_path: str, query: str, location: str, db_url: str, partial: bool):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy.pool import NullPool

    if not os.path.exists(csv_path):
        if not partial:
            jobs[job_id].update(status="error", message="No output CSV found.", progress=0, eta_seconds=0)
        return

    # NullPool avoids exhausting Supabase's connection limit on free plans
    engine = create_engine(db_url, poolclass=NullPool)
    DBSession = sm(bind=engine)
    db = DBSession()

    inserted = skipped = 0
    try:
        batch_id = _find_or_create_batch(db, query, location)

        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row.get("name"):
                    continue
                if db.query(Lead).filter(
                    Lead.name == row["name"],
                    Lead.city == location,
                    Lead.batch_id == batch_id,
                ).first():
                    skipped += 1
                    continue

                try:
                    rating = float(row.get("rating") or 0) or None
                except (ValueError, TypeError):
                    rating = None

                try:
                    review_count = int(row.get("review_count") or 0) or None
                except (ValueError, TypeError):
                    review_count = None

                try:
                    business_age_years = int(row.get("business_age_years") or 0) or None
                except (ValueError, TypeError):
                    business_age_years = None

                db.add(Lead(
                    name               = row["name"],
                    city               = location,
                    phone              = row.get("phone", ""),
                    address            = row.get("address", "") or None,
                    website_status     = "HAS WEBSITE" if row.get("has_website", "").strip().lower() == "yes" else "NO WEBSITE",
                    website_url        = row.get("website", "") or None,
                    category           = row.get("category", "") or None,
                    rating             = rating,
                    review_count       = review_count,
                    business_age_years = business_age_years,
                    score              = score_lead(row, query),
                    pipeline_stage     = "New Lead",
                    batch_id           = batch_id,
                ))
                inserted += 1
        db.commit()
    except Exception as exc:
        db.rollback()
        jobs[job_id].update(status="error", message=f"Database error: {exc}", progress=0)
        return
    finally:
        db.close()
        try:
            os.remove(csv_path)
        except OSError:
            pass

    final_status = "stopped" if partial else "done"
    label = "Stopped early" if partial else "Complete"
    jobs[job_id].update(
        status=final_status,
        progress=100,
        inserted=inserted,
        skipped=skipped,
        eta_seconds=0,
        message=f"{label}! Saved {inserted} new leads ({skipped} duplicates skipped).",
    )


def _check_output_for_blocks(text: str) -> str:
    """
    Parse scraper stdout/stderr for known Google block/CAPTCHA messages.

    IMPORTANT: Keep signal strings tight and specific.
    Broad strings like 'try again later' or bare '429' match normal
    Maps page content and cause false-positive block detection that
    kills the job immediately without ever opening a browser.
    """
    lower = text.lower()

    # CAPTCHA / unusual traffic — very specific phrases only
    if (
        "our systems have detected unusual traffic" in lower
        or "unusual traffic from your computer" in lower
        or "google.com/recaptcha" in lower
        or "i'm not a robot" in lower
    ):
        return "Google detected bot activity (CAPTCHA). Wait 2-4 hours and try again, or use a different network."

    # Rate limiting — require the full phrase, not a bare "429"
    if "rate limit exceeded" in lower or "too many requests" in lower:
        return "Google rate limited your IP. Wait 1-2 hours before scraping again."

    # IP block
    if "ip has been blocked" in lower or "access denied" in lower:
        return "Your IP appears blocked by Google. Try a VPN or different network."

    # Sorry page redirect
    if "google.com/sorry" in lower:
        return "Redirected to Google's sorry page — IP temporarily flagged. Wait a few hours."

    return ""


def run_scrape_job(job_id: str, query: str, location: str, no_website_only: bool, db_url: str):
    jobs[job_id].update(
        status="running",
        message="Starting browser...",
        progress=8,
        found_companies=[],
        found_count=0,
        eta_seconds=120,
    )

    scraper_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "maps_scraper.py"))
    slug = re.sub(r"[^a-z0-9]+", "_", f"{query}_{location}".lower()).strip("_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Cross-platform temp dir — fixes Windows /tmp crash
    csv_path = os.path.join(tempfile.gettempdir(), f"bizscout_{slug}_{timestamp}.csv")

    # NO --headless — headless is blocked by Google.
    # Chrome opens visibly on screen — that's correct behaviour.
    cmd = [
        sys.executable, scraper_path,
        "--query", query,
        "--location", location,
        "--output", csv_path,
        "--workers", "1",
    ]
    if no_website_only:
        cmd.append("--no-website-only")

    jobs[job_id].update(message=f'Scraping "{query}" in {location}...', progress=15)

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        jobs[job_id]["_pid"] = proc.pid
    except Exception as exc:
        jobs[job_id].update(status="error", message=f"Failed to launch scraper: {exc}", progress=0)
        return

    stop_event = threading.Event()
    watcher = threading.Thread(target=watch_csv_for_new_rows, args=(job_id, csv_path, stop_event), daemon=True)
    watcher.start()

    start_time      = time.time()
    last_count      = 0
    last_count_time = time.time()
    MAX_STALL_SECONDS = 120  # save & finish if no new leads for 2 minutes
    MAX_TOTAL_SECONDS = 600  # hard 10-minute cap

    while True:
        # ── Manual stop ───────────────────────────────────────────────────────
        if jobs[job_id].get("stop_requested"):
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            stop_event.set()
            watcher.join(timeout=3)
            jobs[job_id].update(
                message=f"Stopping — saving {jobs[job_id].get('found_count', 0)} leads found so far...",
                progress=90,
            )
            _save_results(job_id, csv_path, query, location, db_url, partial=True)
            return

        elapsed = time.time() - start_time
        jobs[job_id]["progress"] = min(78, int(15 + (elapsed / 150) * 63))

        # ── Stuck detection ───────────────────────────────────────────────────
        current_count = jobs[job_id].get("found_count", 0)
        if current_count > last_count:
            last_count = current_count
            last_count_time = time.time()

        if current_count > 0 and (time.time() - last_count_time) > MAX_STALL_SECONDS:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            stop_event.set()
            watcher.join(timeout=3)
            jobs[job_id].update(
                message=f"Scraper stalled — saving {current_count} leads found...",
                progress=90,
            )
            _save_results(job_id, csv_path, query, location, db_url, partial=True)
            return

        # ── Hard timeout ──────────────────────────────────────────────────────
        if elapsed > MAX_TOTAL_SECONDS:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            stop_event.set()
            watcher.join(timeout=3)
            jobs[job_id].update(
                message=f"Timeout — saving {current_count} leads found...",
                progress=90,
            )
            _save_results(job_id, csv_path, query, location, db_url, partial=True)
            return

        if proc.poll() is not None:
            break
        time.sleep(1)

    stop_event.set()
    watcher.join(timeout=3)

    # ── Read output for error diagnosis ───────────────────────────────────────
    stderr_out = ""
    stdout_out = ""
    try:
        stderr_out = proc.stderr.read() if proc.stderr else ""
    except Exception:
        pass
    try:
        stdout_out = proc.stdout.read() if proc.stdout else ""
    except Exception:
        pass

    all_output = stderr_out + stdout_out

    if proc.returncode != 0:
        block_msg = _check_output_for_blocks(all_output)
        if block_msg:
            jobs[job_id].update(
                status="error",
                message=f"Google block detected: {block_msg}",
                progress=0, eta_seconds=0,
            )
        else:
            debug = all_output[-800:].strip()
            jobs[job_id].update(
                status="error",
                message=f"Scraper error: {debug}",
                progress=0, eta_seconds=0,
            )
        return

    # Soft block check — process exited 0 but output mentions blocks
    block_msg = _check_output_for_blocks(all_output)
    if block_msg and jobs[job_id].get("found_count", 0) == 0:
        jobs[job_id].update(
            status="error",
            message=f"Google block detected: {block_msg}",
            progress=0, eta_seconds=0,
        )
        return

    if not os.path.exists(csv_path):
        found = jobs[job_id].get("found_count", 0)
        if found == 0:
            jobs[job_id].update(
                status="error",
                message="Scraper finished but found 0 results. Google may have blocked the request — try again in a few hours or on a different network.",
                progress=0, eta_seconds=0,
            )
        else:
            jobs[job_id].update(message="Saving leads to database...", progress=88, eta_seconds=5)
            _save_results(job_id, csv_path, query, location, db_url, partial=False)
        return

    jobs[job_id].update(message="Saving leads to database...", progress=88, eta_seconds=5)
    _save_results(job_id, csv_path, query, location, db_url, partial=False)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start")
@limiter.limit("200/minute")
def start_scrape(request: Request, body: ScrapeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued",
        "message": "Job queued — launching scraper...",
        "progress": 0,
        "inserted": 0,
        "skipped": 0,
        "found_companies": [],
        "found_count": 0,
        "eta_seconds": 120,
        "stop_requested": False,
        "query": body.query,
        "location": body.location,
    }
    background_tasks.add_task(run_scrape_job, job_id, body.query, body.location, body.no_website_only, DATABASE_URL)
    return {"job_id": job_id}


@router.get("/status/{job_id}")
@limiter.limit("200/minute")
def scrape_status(request: Request, job_id: str, current_user: User = Depends(get_current_user)):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    j = jobs[job_id].copy()
    j.pop("_pid", None)
    return j


@router.post("/stop/{job_id}")
@limiter.limit("200/minute")
def stop_scrape(request: Request, job_id: str, current_user: User = Depends(get_current_user)):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    if jobs[job_id].get("status") not in ("queued", "running"):
        raise HTTPException(status_code=400, detail="Job is not running")
    jobs[job_id]["stop_requested"] = True
    return {"ok": True}