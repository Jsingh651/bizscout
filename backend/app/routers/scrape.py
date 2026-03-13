import subprocess
import sys
import os
import csv
import re
import uuid
import time
import threading
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db, DATABASE_URL
from app.models.lead import Lead

router = APIRouter(prefix="/scrape", tags=["scrape"])

jobs: dict[str, dict] = {}


class ScrapeRequest(BaseModel):
    query: str
    location: str
    no_website_only: bool = False


def score_lead(row: dict) -> int:
    score = 45
    if row.get("has_website", "").strip().lower() == "no":
        score += 35
    try:
        rating = float(row.get("rating") or 0)
        if rating >= 4.8:
            score += 18
        elif rating >= 4.5:
            score += 12
        elif rating >= 4.0:
            score += 6
    except (ValueError, TypeError):
        pass
    return min(score, 100)


def watch_csv_for_new_rows(job_id: str, csv_path: str, stop_event: threading.Event):
    """
    Tails the CSV as the scraper writes rows live.
    Pushes each new company into jobs[job_id]['found_companies'] immediately.
    Recalculates a dynamic ETA based on discovery rate.
    """
    seen_names: set = set()
    start_time = time.time()

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
                "name": name,
                "phone": row.get("phone", ""),
                "has_website": row.get("has_website", "no").strip().lower() == "yes",
                "rating": row.get("rating", ""),
                "score": score_lead(row),
            })
            jobs[job_id]["found_count"] = len(jobs[job_id]["found_companies"])

        # Recompute ETA dynamically every cycle
        elapsed = time.time() - start_time
        total = jobs[job_id]["found_count"]
        if total > 1 and elapsed > 3:
            rate = total / elapsed  # results per second
            # Assume average Google Maps search returns 15-25 results
            # When rate slows significantly we must be near end, lower ETA fast
            estimated_total = max(total + max(3, int(rate * 10)), 15)
            remaining = (estimated_total - total) / rate if rate > 0 else 60
            remaining = min(max(int(remaining), 3), 180)
            jobs[job_id]["eta_seconds"] = remaining

        if jobs[job_id].get("status") in ("done", "error", "stopped"):
            break

        time.sleep(0.7)


def _save_results(job_id: str, csv_path: str, location: str, db_url: str, partial: bool):
    """Persist CSV rows to DB; update job to done/stopped."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker as sm

    if not os.path.exists(csv_path):
        if not partial:
            jobs[job_id].update(status="error", message="No output CSV found.", progress=0, eta_seconds=0)
        return

    engine = create_engine(db_url)
    DBSession = sm(bind=engine)
    db = DBSession()

    inserted = skipped = 0
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row.get("name"):
                    continue
                if db.query(Lead).filter(Lead.name == row["name"], Lead.city == location).first():
                    skipped += 1
                    continue
                db.add(Lead(
                    name=row["name"],
                    city=location,
                    phone=row.get("phone", ""),
                    website_status="HAS WEBSITE" if row.get("has_website", "").strip().lower() == "yes" else "NO WEBSITE",
                    score=score_lead(row),
                    pipeline_stage="New Lead",
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


def run_scrape_job(job_id: str, query: str, location: str, no_website_only: bool, db_url: str):
    jobs[job_id].update(
        status="running",
        message="Starting headless browser...",
        progress=8,
        found_companies=[],
        found_count=0,
        eta_seconds=120,
    )

    scraper_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "maps_scraper.py")
    )
    slug = re.sub(r"[^a-z0-9]+", "_", f"{query}_{location}".lower()).strip("_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"/tmp/bizscout_{slug}_{timestamp}.csv"

    cmd = [sys.executable, scraper_path, "--query", query, "--location", location, "--output", csv_path, "--headless"]
    if no_website_only:
        cmd.append("--no-website-only")

    jobs[job_id].update(message=f'Scraping "{query}" in {location}...', progress=15)

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        jobs[job_id]["_pid"] = proc.pid
    except Exception as exc:
        jobs[job_id].update(status="error", message=f"Failed to launch scraper: {exc}", progress=0)
        return

    # Start CSV watcher thread
    stop_event = threading.Event()
    watcher = threading.Thread(target=watch_csv_for_new_rows, args=(job_id, csv_path, stop_event), daemon=True)
    watcher.start()

    start_time = time.time()
    while True:
        # Stop requested by user
        if jobs[job_id].get("stop_requested"):
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            stop_event.set()
            watcher.join(timeout=3)
            jobs[job_id].update(
                message=f"Stopping — saving {jobs[job_id].get('found_count', 0)} companies found so far...",
                progress=90,
            )
            _save_results(job_id, csv_path, location, db_url, partial=True)
            return

        # Heuristic progress while scraper runs (15 → 78%)
        elapsed = time.time() - start_time
        jobs[job_id]["progress"] = min(78, int(15 + (elapsed / 150) * 63))

        if proc.poll() is not None:
            break
        time.sleep(1)

    stop_event.set()
    watcher.join(timeout=3)

    stderr_out = ""
    if proc.stderr:
        try:
            stderr_out = proc.stderr.read()[-600:]
        except Exception:
            pass

    if proc.returncode != 0:
        jobs[job_id].update(status="error", message=f"Scraper error: {stderr_out}", progress=0, eta_seconds=0)
        return

    if not os.path.exists(csv_path):
        jobs[job_id].update(status="error", message="Scraper finished but produced no CSV.", progress=0, eta_seconds=0)
        return

    jobs[job_id].update(message="Saving leads to database...", progress=88, eta_seconds=5)
    _save_results(job_id, csv_path, location, db_url, partial=False)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start")
def start_scrape(body: ScrapeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
    background_tasks.add_task(
        run_scrape_job, job_id, body.query, body.location, body.no_website_only, DATABASE_URL
    )
    return {"job_id": job_id}


@router.get("/status/{job_id}")
def scrape_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    j = jobs[job_id].copy()
    j.pop("_pid", None)
    return j


@router.post("/stop/{job_id}")
def stop_scrape(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    if jobs[job_id].get("status") not in ("queued", "running"):
        raise HTTPException(status_code=400, detail="Job is not running")
    jobs[job_id]["stop_requested"] = True
    return {"ok": True}