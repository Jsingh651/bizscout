"""
BizScout - Hardened Automated Batch Runner
==========================================
- No-website leads only (has_website == No)
- Up to 200 no-site leads per niche/city combo (configurable)
- 3 delay profiles: fast / safe / stealth
- Exponential backoff on errors
- IP cooldown after consecutive blocks
- Skips a job after 3 failed attempts — never crashes the whole run
- Checkpoint file — resume mid-session with --resume
- Live summary CSV written after every job
- Runs FOREVER until you Ctrl+C — no time limit
- Ctrl+C saves checkpoint and exits cleanly

Usage:
    python batch_runner.py                          # runs forever, safe profile
    python batch_runner.py --resume                 # skip already-completed jobs
    python batch_runner.py --dry-run                # print plan only
    python batch_runner.py --delay-profile stealth  # slowest, safest
    python batch_runner.py --delay-profile fast     # faster, more risk
    python batch_runner.py --cap 150                # 150 leads per combo
    python batch_runner.py --niches "HVAC,Roofing" --cities "Sacramento, CA|Fresno, CA"
"""

import argparse
import csv
import json
import logging
import os
import random
import re
import sys
import tempfile
import time
from datetime import datetime
from itertools import product

# ── Make app modules importable when run from project root ────────────────────
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.database import DATABASE_URL
from app.models.lead import Lead
from app.models.batch import Batch

try:
    from maps_scraper import scrape_google_maps
except ImportError:
    print("ERROR: Cannot import maps_scraper. Run this script from the same directory as maps_scraper.py")
    sys.exit(1)


# ─── DIRECTORIES ──────────────────────────────────────────────────────────────

os.makedirs("logs", exist_ok=True)
os.makedirs("checkpoints", exist_ok=True)

_SESSION_TS     = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE        = f"logs/batch_{_SESSION_TS}.log"
SUMMARY_FILE    = f"logs/summary_{_SESSION_TS}.csv"
CHECKPOINT_FILE = "checkpoints/last_session.json"


# ─── LOGGING ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ]
)
log = logging.getLogger("batch_runner")


# ─── DELAY PROFILES ───────────────────────────────────────────────────────────

DELAY_PROFILES = {
    "fast": {
        "between_jobs":     (60,  120),
        "long_break":       (180, 300),
        "long_break_every": 10,
        "cooldown":         (1800, 2700),
        "retry_base":       30,
    },
    "safe": {
        "between_jobs":     (120, 200),
        "long_break":       (300, 480),
        "long_break_every": 8,
        "cooldown":         (2700, 3600),
        "retry_base":       60,
    },
    "stealth": {
        "between_jobs":     (180, 360),
        "long_break":       (480, 720),
        "long_break_every": 6,
        "cooldown":         (3600, 5400),
        "retry_base":       90,
    },
}

DEFAULT_PROFILE            = "safe"
LEADS_CAP_PER_COMBO        = 200
MAX_RETRIES_PER_JOB        = 3
MAX_BLOCKS_BEFORE_COOLDOWN = 2


# ─── NICHES ───────────────────────────────────────────────────────────────────

DEFAULT_NICHES = [
    "HVAC",
    "Roofing",
    "Plumbing",
    "Electricians",
    "Landscaping",
    "Pest Control",
    "Tree Service",
    "Pressure Washing",
    "Concrete Contractors",
    "Fence Installation",
    "Handymen",
    "Painters",
    "Appliance Repair",
    "Gutter Cleaning",
    "Pool Cleaning",
    "Food Trucks",
    "Restaurants",
    "Bakeries",
    "Cafes",
    "Mexican Restaurants",
    "Pizza Places",
    "Catering",
    "Auto Repair",
    "Auto Body Shops",
    "Auto Detailing",
    "Towing Services",
    "Hair Salons",
    "Barbershops",
    "Nail Salons",
    "Massage Therapy",
    "Chiropractors",
    "Dentists",
    "Veterinarians",
    "Cleaning Services",
    "Junk Removal",
    "Moving Companies",
]


# ─── CA CITIES ────────────────────────────────────────────────────────────────

DEFAULT_CA_CITIES = [
    "Los Angeles, CA",
    "San Diego, CA",
    "San Jose, CA",
    "San Francisco, CA",
    "Fresno, CA",
    "Sacramento, CA",
    "Long Beach, CA",
    "Oakland, CA",
    "Bakersfield, CA",
    "Anaheim, CA",
    "Santa Ana, CA",
    "Riverside, CA",
    "Stockton, CA",
    "Irvine, CA",
    "Chula Vista, CA",
    "Fremont, CA",
    "San Bernardino, CA",
    "Modesto, CA",
    "Fontana, CA",
    "Moreno Valley, CA",
    "Glendale, CA",
    "Huntington Beach, CA",
    "Santa Clarita, CA",
    "Garden Grove, CA",
    "Oceanside, CA",
    "Rancho Cucamonga, CA",
    "Santa Rosa, CA",
    "Ontario, CA",
    "Elk Grove, CA",
    "Roseville, CA",
    "Oxnard, CA",
    "Corona, CA",
    "Salinas, CA",
    "Hayward, CA",
    "Pomona, CA",
    "Sunnyvale, CA",
    "Escondido, CA",
    "Torrance, CA",
    "Pasadena, CA",
    "Visalia, CA",
    "Concord, CA",
    "Santa Clara, CA",
    "Victorville, CA",
]


# ─── BLOCK DETECTION ──────────────────────────────────────────────────────────

REAL_BLOCK_PHRASES = [
    "our systems have detected unusual traffic",
    "unusual traffic from your computer",
    "google.com/recaptcha",
    "i'm not a robot",
    "google.com/sorry",
    "rate limit exceeded",
    "too many requests",
    "ip has been blocked",
    "access denied",
    "captcha detected",
    "blocked on load",
    "blocked after consent",
    "blocked during scroll",
    "blocked on listing",
]

def is_block_error(message: str) -> bool:
    lower = (message or "").lower()
    return any(p in lower for p in REAL_BLOCK_PHRASES)


# ─── DATABASE ─────────────────────────────────────────────────────────────────

def _get_db():
    engine = create_engine(DATABASE_URL, poolclass=NullPool)
    return sessionmaker(bind=engine)()


def _count_no_site(niche: str, city: str) -> int:
    db = _get_db()
    try:
        batch = (
            db.query(Batch)
            .filter(Batch.query.ilike(niche.strip()), Batch.location.ilike(city.strip()))
            .first()
        )
        if not batch:
            return 0
        return (
            db.query(func.count(Lead.id))
            .filter(Lead.batch_id == batch.id, Lead.website_status == "NO WEBSITE")
            .scalar() or 0
        )
    finally:
        db.close()


def _find_or_create_batch(db, query: str, location: str) -> int:
    existing = (
        db.query(Batch)
        .filter(Batch.query.ilike(query.strip()), Batch.location.ilike(location.strip()))
        .order_by(Batch.created_at.desc())
        .first()
    )
    if existing:
        return existing.id
    b = Batch(query=query.strip(), location=location.strip())
    db.add(b)
    db.commit()
    db.refresh(b)
    return b.id


def _score(row: dict, query: str = "") -> int:
    HIGH = {
        "restaurant","food truck","cafe","bakery","pizza","sushi","mexican","chinese",
        "thai","indian","italian","burger","sandwich","catering","auto repair","auto body",
        "mechanic","plumber","plumbing","hvac","roofing","roofer","landscaping","lawn care",
        "electrician","contractor","hair salon","barbershop","barber","nail salon","spa",
        "massage","dentist","chiropractor","veterinarian","vet","pet grooming","cleaning",
        "pest control","tree service","painter","handyman",
    }
    MED = {
        "gym","fitness","yoga","pilates","martial arts","dance","accountant","tax",
        "insurance","real estate","florist","photographer","videographer","printing",
        "locksmith","dry cleaner","tailor","shoe repair","laundry",
    }
    score = 0
    if str(row.get("has_website", "")).strip().lower() == "no":
        score += 35
    try:
        r = float(row.get("rating") or 0)
        score += 20 if r>=4.8 else 14 if r>=4.5 else 8 if r>=4.0 else 3 if r>=3.5 else 0
    except: pass
    try:
        rc = int(row.get("review_count") or 0)
        score += 15 if rc>=200 else 12 if rc>=100 else 8 if rc>=50 else 4 if rc>=20 else 0
    except: pass
    try:
        age = int(row.get("business_age_years") or 0)
        score += 12 if age>=7 else 9 if age>=5 else 6 if age>=3 else 3 if age>=1 else 0
    except: pass
    text = f"{(row.get('category') or '').lower()} {(query or '').lower()}"
    if any(kw in text for kw in HIGH): score += 10
    elif any(kw in text for kw in MED): score += 5
    if row.get("phone","").strip(): score += 4
    if row.get("address","").strip(): score += 4
    return min(score, 100)


def save_no_site_leads(results: list, niche: str, city: str, cap: int) -> tuple:
    no_site = [r for r in results if str(r.get("has_website","")).strip().lower() != "yes"]
    if not no_site:
        return 0, 0, 0

    already    = _count_no_site(niche, city)
    slots_left = max(0, cap - already)

    if slots_left == 0:
        log.info(f"  Cap already reached ({already}/{cap}) — nothing saved")
        return 0, 0, len(no_site)

    db = _get_db()
    inserted = dupes = over_cap = 0

    try:
        batch_id = _find_or_create_batch(db, niche, city)

        for row in no_site:
            if not row.get("name"):
                continue
            if inserted >= slots_left:
                over_cap += 1
                continue

            exists = db.query(Lead).filter(
                Lead.name == row["name"],
                Lead.city == city,
                Lead.batch_id == batch_id,
            ).first()
            if exists:
                dupes += 1
                continue

            try:    rating = float(row.get("rating") or 0) or None
            except: rating = None
            try:    rc = int(row.get("review_count") or 0) or None
            except: rc = None
            try:    age = int(row.get("business_age_years") or 0) or None
            except: age = None

            db.add(Lead(
                name               = row["name"],
                city               = city,
                phone              = row.get("phone", ""),
                address            = row.get("address") or None,
                website_status     = "NO WEBSITE",
                website_url        = None,
                category           = row.get("category") or None,
                rating             = rating,
                review_count       = rc,
                business_age_years = age,
                score              = _score(row, niche),
                pipeline_stage     = "New Lead",
                batch_id           = batch_id,
            ))
            inserted += 1

        db.commit()
    except Exception as e:
        db.rollback()
        log.error(f"  DB error: {e}")
    finally:
        db.close()

    return inserted, dupes, over_cap


# ─── CHECKPOINT ───────────────────────────────────────────────────────────────

def _save_checkpoint(completed: set):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({
            "session_ts": _SESSION_TS,
            "completed":  list(completed),
            "saved_at":   datetime.now().isoformat(),
        }, f, indent=2)


def _load_checkpoint() -> set:
    if not os.path.exists(CHECKPOINT_FILE):
        return set()
    try:
        with open(CHECKPOINT_FILE) as f:
            data = json.load(f)
        completed = set(data.get("completed", []))
        log.info(f"Checkpoint loaded — {len(completed)} jobs already done "
                 f"(saved {data.get('saved_at','?')})")
        return completed
    except Exception as e:
        log.warning(f"Could not load checkpoint: {e}")
        return set()


# ─── SUMMARY CSV ──────────────────────────────────────────────────────────────

_FIELDS = [
    "job_num","niche","city","status","attempt",
    "total_found","no_site_found","inserted","dupes","over_cap",
    "duration_s","timestamp","notes",
]

def _init_summary():
    with open(SUMMARY_FILE, "w", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=_FIELDS).writeheader()

def _write_summary(row: dict):
    with open(SUMMARY_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=_FIELDS)
        w.writerow({k: row.get(k, "") for k in _FIELDS})


# ─── SLEEP UTILITY ────────────────────────────────────────────────────────────

def _sleep(seconds: float, reason: str = ""):
    seconds = max(1, seconds)
    label   = f" [{reason}]" if reason else ""
    log.info(f"  ⏸  {int(seconds)}s{label}")
    end = time.time() + seconds
    while time.time() < end:
        time.sleep(min(5, end - time.time()))


def _jitter(base: float, pct: float = 0.2) -> float:
    return base * random.uniform(1 - pct, 1 + pct)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def run_batch(
    niches:       list = None,
    cities:       list = None,
    profile_name: str  = DEFAULT_PROFILE,
    cap:          int  = LEADS_CAP_PER_COMBO,
    dry_run:      bool = False,
    resume:       bool = False,
):
    niches  = niches or DEFAULT_NICHES
    cities  = cities or DEFAULT_CA_CITIES
    profile = DELAY_PROFILES[profile_name]

    # Build shuffled job queue
    all_jobs = list(product(niches, cities))
    random.shuffle(all_jobs)

    completed = _load_checkpoint() if resume else set()
    pending   = [(n, c) for (n, c) in all_jobs if f"{n}||{c}" not in completed]

    log.info("=" * 72)
    log.info("BizScout Hardened Batch Runner")
    log.info(f"  Profile         : {profile_name}")
    log.info(f"  Duration        : unlimited — Ctrl+C to stop")
    log.info(f"  Niches          : {len(niches)}")
    log.info(f"  Cities          : {len(cities)}")
    log.info(f"  Jobs pending    : {len(pending)} / {len(all_jobs)}")
    log.info(f"  Cap per combo   : {cap} no-site leads")
    log.info(f"  Between jobs    : {profile['between_jobs'][0]}–{profile['between_jobs'][1]}s")
    log.info(f"  Long break      : every {profile['long_break_every']} jobs  "
             f"({profile['long_break'][0]}–{profile['long_break'][1]}s)")
    log.info(f"  Block cooldown  : {profile['cooldown'][0]//60}–{profile['cooldown'][1]//60} min")
    log.info(f"  Max retries     : {MAX_RETRIES_PER_JOB} per job")
    log.info(f"  Log             : {LOG_FILE}")
    log.info(f"  Summary         : {SUMMARY_FILE}")
    log.info("=" * 72)

    if dry_run:
        log.info("\nDRY RUN — first 40 pending jobs:")
        for i, (n, c) in enumerate(pending[:40], 1):
            have = _count_no_site(n, c)
            log.info(f"  {i:3d}. {n:32s} | {c:25s} | {have}/{cap} saved")
        if len(pending) > 40:
            log.info(f"  ... and {len(pending)-40} more")
        mins_per_job = (profile['between_jobs'][0] + profile['between_jobs'][1]) / 2 / 60
        log.info(f"\nEst. avg time per job: {mins_per_job:.1f} min")
        return

    _init_summary()

    total_inserted     = 0
    total_jobs_run     = 0
    total_jobs_failed  = 0
    consecutive_blocks = 0
    job_num            = 0

    for niche, city in pending:

        job_num   += 1
        combo_key  = f"{niche}||{city}"

        # Cap gate
        already = _count_no_site(niche, city)
        if already >= cap:
            log.info(f"[{job_num}] SKIP cap full ({already}/{cap}): {niche} | {city}")
            completed.add(combo_key)
            _save_checkpoint(completed)
            continue

        log.info(f"\n[Job {job_num}] {niche}  ·  {city}  ({already}/{cap} saved)")

        attempt        = 0
        inserted       = dupes = over_cap_count = 0
        results        = []
        status         = "pending"
        notes          = ""

        while attempt < MAX_RETRIES_PER_JOB:
            attempt += 1
            t0       = time.time()
            results  = []

            try:
                slug     = re.sub(r"[^a-z0-9]+", "_", f"{niche}_{city}".lower()).strip("_")
                ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
                csv_path = os.path.join(tempfile.gettempdir(), f"bs_{slug}_{ts}.csv")

                results = scrape_google_maps(
                    query       = niche,
                    location    = city,
                    headless    = False,
                    num_workers = 1,
                    output_csv  = csv_path,
                )

                try:
                    if os.path.exists(csv_path):
                        os.remove(csv_path)
                except OSError:
                    pass

                no_site_count = sum(
                    1 for r in results
                    if str(r.get("has_website","")).strip().lower() != "yes"
                )
                log.info(f"  Attempt {attempt}: {len(results)} total, {no_site_count} no-site")

                if results:
                    inserted, dupes, over_cap_count = save_no_site_leads(
                        results, niche, city, cap
                    )
                    total_inserted    += inserted
                    status             = "success"
                    consecutive_blocks = 0
                    notes              = f"{no_site_count} no-site, +{inserted} saved"
                    break

                else:
                    status = "no_results"
                    notes  = "0 results"
                    log.warning(f"  Attempt {attempt}: 0 results returned")
                    if attempt < MAX_RETRIES_PER_JOB:
                        backoff = _jitter(profile["retry_base"] * (2 ** (attempt - 1)))
                        _sleep(backoff, f"backoff {attempt}/{MAX_RETRIES_PER_JOB}")

            except KeyboardInterrupt:
                log.info("\n⚡ Ctrl+C — saving checkpoint and exiting cleanly...")
                _save_checkpoint(completed)
                _print_totals(total_jobs_run, total_jobs_failed, total_inserted)
                sys.exit(0)

            except Exception as exc:
                err    = str(exc)
                status = "error"
                notes  = err[:200]
                log.error(f"  Attempt {attempt} error: {err[:200]}")

                if is_block_error(err):
                    consecutive_blocks += 1
                    log.warning(f"  🚫 Block detected (streak: {consecutive_blocks})")

                    if consecutive_blocks >= MAX_BLOCKS_BEFORE_COOLDOWN:
                        cd = random.randint(*profile["cooldown"])
                        log.warning(f"  {consecutive_blocks} consecutive blocks → IP cooldown {cd//60} min")
                        _sleep(cd, "IP cooldown")
                        consecutive_blocks = 0
                    else:
                        _sleep(_jitter(profile["retry_base"] * 3), "post-block wait")
                else:
                    if attempt < MAX_RETRIES_PER_JOB:
                        backoff = _jitter(profile["retry_base"] * (2 ** (attempt - 1)))
                        _sleep(backoff, f"error backoff {attempt}/{MAX_RETRIES_PER_JOB}")

            finally:
                _write_summary({
                    "job_num":       job_num,
                    "niche":         niche,
                    "city":          city,
                    "status":        status,
                    "attempt":       attempt,
                    "total_found":   len(results),
                    "no_site_found": sum(
                        1 for r in results
                        if str(r.get("has_website","")).strip().lower() != "yes"
                    ),
                    "inserted":      inserted,
                    "dupes":         dupes,
                    "over_cap":      over_cap_count,
                    "duration_s":    round(time.time() - t0, 1),
                    "timestamp":     datetime.now().isoformat(),
                    "notes":         notes,
                })

        # Post-retry
        if status in ("success", "no_results"):
            completed.add(combo_key)
            _save_checkpoint(completed)
        else:
            total_jobs_failed += 1
            log.warning(f"  ✗ Skipping job after {MAX_RETRIES_PER_JOB} failed attempts")

        total_jobs_run += 1
        log.info(
            f"  ▸ Session: {total_inserted} no-site leads | "
            f"{total_jobs_run} jobs | {total_jobs_failed} skipped"
        )

        # Long break every N jobs
        if total_jobs_run % profile["long_break_every"] == 0:
            lb = _jitter(random.randint(*profile["long_break"]))
            log.info(f"  🛑 Long break #{total_jobs_run // profile['long_break_every']} — simulating human session end")
            _sleep(lb, "long break")
        else:
            delay = _jitter(random.randint(*profile["between_jobs"]))
            _sleep(delay, "between jobs")

    # All jobs done
    _save_checkpoint(completed)
    log.info("\n✅ All jobs completed!")
    _print_totals(total_jobs_run, total_jobs_failed, total_inserted)
    log.info(f"  Summary    : {SUMMARY_FILE}")
    log.info(f"  Log        : {LOG_FILE}")
    log.info(f"  Checkpoint : {CHECKPOINT_FILE}")


def _print_totals(jobs_run, jobs_failed, inserted):
    log.info("\n" + "=" * 72)
    log.info("RUN COMPLETE")
    log.info(f"  Jobs completed  : {jobs_run}")
    log.info(f"  Jobs skipped    : {jobs_failed}")
    log.info(f"  No-site leads   : {inserted} saved to DB")
    log.info("=" * 72)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="BizScout Hardened Batch Runner — runs until Ctrl+C")
    p.add_argument("--niches",        type=str, default=None,
                   help='Pipe-separated niches e.g. "HVAC|Roofing|Plumbing"')
    p.add_argument("--cities",        type=str, default=None,
                   help='Pipe-separated cities e.g. "Sacramento, CA|Fresno, CA"')
    p.add_argument("--cap",           type=int, default=LEADS_CAP_PER_COMBO,
                   help=f"Max no-site leads per niche+city combo (default: {LEADS_CAP_PER_COMBO})")
    p.add_argument("--delay-profile", type=str, default=DEFAULT_PROFILE,
                   choices=list(DELAY_PROFILES.keys()),
                   help="fast | safe | stealth  (default: safe)")
    p.add_argument("--resume",        action="store_true",
                   help="Skip jobs already completed in last session")
    p.add_argument("--dry-run",       action="store_true",
                   help="Print job plan without scraping")
    args = p.parse_args()

    niches = [n.strip() for n in args.niches.split("|")] if args.niches else None
    cities = [c.strip() for c in args.cities.split("|")] if args.cities else None

    run_batch(
        niches       = niches,
        cities       = cities,
        profile_name = args.delay_profile,
        cap          = args.cap,
        dry_run      = args.dry_run,
        resume       = args.resume,
    )


if __name__ == "__main__":
    main()