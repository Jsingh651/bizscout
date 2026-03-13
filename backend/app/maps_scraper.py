"""
BizScout - Google Maps Scraper (Multithreaded)
Scrapes Google Maps for businesses by niche + city, extracts
name, phone, address, website status, and exports to CSV.

Speed strategy: Phase 1 (scroll/collect listing URLs) runs in ONE browser
as before. Phase 2 (open each listing and extract details) runs across
WORKERS independent browser sessions in parallel — each with its own
user agent, randomized delays, and Chrome profile so they look like
separate human users to Google.

Usage:
    python maps_scraper.py --query "food trucks" --location "Sacramento, CA"
    python maps_scraper.py --query "hair salons" --location "Elk Grove, CA" --no-website-only
    python maps_scraper.py --query "auto repair" --location "Roseville, CA" --output leads.csv --headless
    python maps_scraper.py --query "plumbers" --location "Dallas, TX" --workers 2
"""

import sys

# ── CHECK IMPORTS EARLY WITH CLEAR ERROR MESSAGES ────────────────────────────
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ Missing: beautifulsoup4\n   Run: pip install beautifulsoup4")
    sys.exit(1)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except ImportError:
    print("❌ Missing: selenium\n   Run: pip install selenium")
    sys.exit(1)

try:
    from webdriver_manager.chrome import ChromeDriverManager
    from selenium.webdriver.chrome.service import Service as ChromeService
    HAS_WEBDRIVER_MANAGER = True
except ImportError:
    HAS_WEBDRIVER_MANAGER = False
    print("⚠️  webdriver-manager not found — will use system chromedriver")
    print("   To auto-manage ChromeDriver: pip install webdriver-manager\n")

import argparse
import csv
import os
import queue
import random
import re
import tempfile
import threading
import time
from datetime import datetime
from urllib.parse import quote_plus

print("✅ All imports OK")


# ─── ANTI-DETECTION CONFIG ────────────────────────────────────────────────────

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# All original delays preserved exactly — do NOT tighten these
DELAY_BETWEEN_CLICKS  = (1.5, 3.5)   # per worker, between each listing click
DELAY_BETWEEN_SCROLLS = (0.8, 2.0)   # scroll phase (single browser)
DELAY_AFTER_LOAD      = (3.0, 5.0)   # initial page load

# Extra per-worker stagger so all workers don't fire simultaneously
WORKER_STAGGER_DELAY  = (4.0, 8.0)   # each worker waits this before starting

# Safety cap: never run more than 3 workers — beyond this you look like a bot farm
MAX_WORKERS = 3

MAX_RESULTS = 120  # Google Maps hard cap


# ─── DRIVER SETUP ─────────────────────────────────────────────────────────────

def build_driver(headless: bool = False, user_data_dir: str | None = None) -> webdriver.Chrome:
    """
    Build an isolated Chrome instance.
    Each worker gets its own user_data_dir (fresh profile) and a different
    user agent — from Google's perspective these are separate browser sessions.
    """
    options = Options()

    if headless:
        options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1366,768")
    options.add_argument("--start-maximized")
    options.add_argument(f"--user-agent={random.choice(USER_AGENTS)}")

    # Isolated profile per worker — prevents cookie/session sharing
    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")

    options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("prefs", {
        "credentials_enable_service": False,
        "profile.password_manager_enabled": False,
        "profile.default_content_setting_values.notifications": 2,
    })

    if HAS_WEBDRIVER_MANAGER:
        driver = webdriver.Chrome(
            service=ChromeService(ChromeDriverManager().install()),
            options=options
        )
    else:
        driver = webdriver.Chrome(options=options)

    # Patch out webdriver fingerprint (same as original)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        """
    })

    return driver


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def human_delay(range_tuple: tuple) -> None:
    time.sleep(random.uniform(*range_tuple))


def human_scroll(driver, element, pixels: int = 300) -> None:
    amount = pixels + random.randint(-50, 50)
    driver.execute_script("arguments[0].scrollTop += arguments[1];", element, amount)
    human_delay(DELAY_BETWEEN_SCROLLS)


def move_mouse_randomly(driver) -> None:
    try:
        ActionChains(driver).move_by_offset(
            random.randint(-50, 50),
            random.randint(-50, 50)
        ).perform()
    except Exception:
        pass


# ─── PHASE 1: COLLECT LISTING URLS ───────────────────────────────────────────

def collect_listing_urls(query: str, location: str, headless: bool) -> list[str]:
    """
    Phase 1 — exactly as your partner wrote it.
    Single browser, scrolls the sidebar, collects href from every listing card.
    Returns a list of Google Maps place URLs.
    """
    search_term = f"{query} in {location}"
    url = f"https://www.google.com/maps/search/{quote_plus(search_term)}"

    print(f"🔍 Query    : {search_term}")
    print(f"🌐 URL      : {url}\n")
    print("🚀 [Phase 1] Starting collection browser...")

    driver = build_driver(headless=headless)
    urls: list[str] = []

    try:
        print("📡 Loading Google Maps...")
        driver.get(url)
        human_delay(DELAY_AFTER_LOAD)
        print("✅ Page loaded\n")

        # Dismiss cookie/consent banners
        for btn_text in ["Accept all", "I agree", "Reject all", "Accept"]:
            try:
                btn = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{btn_text}')]"))
                )
                btn.click()
                print(f"✅ Dismissed consent banner: '{btn_text}'")
                human_delay((1, 2))
                break
            except Exception:
                pass

        # Wait for results sidebar
        print("⏳ Waiting for results sidebar...")
        try:
            sidebar = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed']"))
            )
            print("✅ Sidebar found\n")
        except Exception:
            print("❌ Could not find results sidebar — possible CAPTCHA or no results.")
            return []

        # Scroll to load all listings (unchanged from original)
        print("📜 Scrolling to load all results", end="", flush=True)
        last_count = 0
        stale_rounds = 0

        while True:
            listings = driver.find_elements(By.CSS_SELECTOR, "div[role='feed'] > div > div > a")
            current_count = len(listings)
            print(".", end="", flush=True)

            if current_count >= MAX_RESULTS:
                break

            try:
                end_el = driver.find_element(
                    By.XPATH, "//*[contains(text(), \"You've reached the end\")]"
                )
                if end_el:
                    break
            except Exception:
                pass

            if current_count == last_count:
                stale_rounds += 1
                if stale_rounds >= 4:
                    break
            else:
                stale_rounds = 0

            last_count = current_count
            human_scroll(driver, sidebar, pixels=500)
            move_mouse_randomly(driver)

        # Grab the href from each listing card — this is the direct Maps place URL
        listings = driver.find_elements(By.CSS_SELECTOR, "div[role='feed'] > div > div > a")
        for a in listings:
            href = a.get_attribute("href")
            if href and "/maps/place/" in href:
                urls.append(href)

        print(f" {len(urls)} listing URLs collected\n")

    except Exception as e:
        print(f"\n❌ Phase 1 error: {e}")
    finally:
        driver.quit()
        print("🔒 Collection browser closed\n")

    return urls


# ─── PHASE 2: PARALLEL DETAIL EXTRACTION ─────────────────────────────────────

def worker_extract(
    worker_id: int,
    url_queue: queue.Queue,
    results_list: list,
    results_lock: threading.Lock,
    csv_path: str,
    csv_lock: threading.Lock,
    headless: bool,
    stop_event: threading.Event,
) -> None:
    """
    One worker thread.

    Each worker:
    - Gets its own Chrome instance with an isolated temp profile + unique user agent
    - Staggers its start time so workers don't all fire at once
    - Navigates directly to each listing URL (no click-and-back needed)
    - Keeps all original human delays between requests
    - Writes results directly to the shared CSV as it finds them (live streaming)
    """
    # Stagger start: worker 0 starts immediately, others wait a random interval
    if worker_id > 0:
        stagger = random.uniform(*WORKER_STAGGER_DELAY) * worker_id
        print(f"  [W{worker_id}] Waiting {stagger:.1f}s before starting...")
        time.sleep(stagger)

    if stop_event.is_set():
        return

    # Isolated temp profile — critical for session isolation
    profile_dir = tempfile.mkdtemp(prefix=f"bizscout_w{worker_id}_")
    driver = None

    try:
        print(f"  [W{worker_id}] 🚀 Starting browser (isolated profile)...")
        driver = build_driver(headless=headless, user_data_dir=profile_dir)
        print(f"  [W{worker_id}] ✅ Browser ready")

        while not stop_event.is_set():
            try:
                place_url = url_queue.get(timeout=3)
            except queue.Empty:
                break

            try:
                print(f"  [W{worker_id}] 📍 Navigating to listing...", end="", flush=True)

                driver.get(place_url)
                # Use the same delay range as the original click delay
                human_delay(DELAY_BETWEEN_CLICKS)

                # Wait for detail panel (same selector as original)
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "h1.DUwDvf, h1[class*='fontHeadline'], div.fontHeadlineLarge")
                    )
                )

                html = driver.page_source
                data = parse_listing_detail(html)
                move_mouse_randomly(driver)

                if data["name"]:
                    # Thread-safe: add to in-memory list
                    with results_lock:
                        results_list.append(data)

                    # Thread-safe: append to CSV immediately (live streaming)
                    with csv_lock:
                        _append_csv_row(csv_path, data)

                    tag = "🚫 no website" if not data["website"] else "🌐 has website"
                    print(f" {data['name']} — {tag}")
                else:
                    print(" skipped (no name)")

            except Exception as e:
                print(f"  [W{worker_id}] ⚠️  {str(e)[:80]}")
            finally:
                url_queue.task_done()

            # Small extra pause between requests — keeps each worker human-paced
            human_delay((0.5, 1.2))

    except Exception as e:
        print(f"  [W{worker_id}] ❌ Fatal: {e}")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        # Clean up temp profile
        try:
            import shutil
            shutil.rmtree(profile_dir, ignore_errors=True)
        except Exception:
            pass
        print(f"  [W{worker_id}] 🔒 Browser closed")


def _append_csv_row(csv_path: str, row: dict) -> None:
    """Appends one row to the CSV. Creates the file with headers if it doesn't exist yet."""
    fieldnames = ["name", "phone", "address", "website", "has_website", "category", "rating"]
    file_exists = os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in fieldnames})


# ─── PARSE LISTING DETAIL ─────────────────────────────────────────────────────
# Unchanged from original — your partner's parsing logic

def parse_listing_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    phone_re = re.compile(r"\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}")

    # Name
    name = ""
    for selector in [
        lambda s: s.find("h1", class_=lambda c: c and "DUwDvf" in c),
        lambda s: s.find("h1"),
    ]:
        el = selector(soup)
        if el:
            name = el.get_text(strip=True)
            break

    # Phone
    phone = ""
    for btn in soup.find_all("button"):
        label = btn.get("aria-label", "")
        m = phone_re.search(label)
        if m:
            phone = m.group()
            break
    if not phone:
        for el in soup.find_all(attrs={"data-tooltip": True}):
            m = phone_re.search(el.get("data-tooltip", ""))
            if m:
                phone = m.group()
                break
    if not phone:
        m = re.search(r"\(\d{3}\)\s*\d{3}-\d{4}", soup.get_text())
        if m:
            phone = m.group()

    # Address
    address = ""
    for btn in soup.find_all("button"):
        label = btn.get("aria-label", "")
        if re.search(r"\d+\s+\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pkwy|Hwy)", label, re.I):
            address = label.replace("Address: ", "").strip()
            break

    # Website
    website = ""
    for el in soup.find_all("a", {"aria-label": re.compile(r"website", re.I)}):
        website = el.get("href", "")
        break
    if not website:
        for el in soup.find_all("a", {"data-value": "Website"}):
            website = el.get("href", "")
            break
    if not website:
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            label = a.get("aria-label", "")
            if (
                "website" in label.lower() and
                href.startswith("http") and
                "google.com" not in href
            ):
                website = href
                break

    # Category
    category = ""
    cat_el = soup.find("button", class_=lambda c: c and "DkEaL" in str(c))
    if cat_el:
        category = cat_el.get_text(strip=True)

    # Rating
    rating = ""
    rating_el = soup.find("div", class_=lambda c: c and "F7nice" in str(c))
    if rating_el:
        spans = rating_el.find_all("span")
        if spans:
            rating = spans[0].get_text(strip=True)

    return {
        "name": name,
        "phone": phone,
        "address": address,
        "website": website,
        "has_website": "Yes" if website else "No",
        "category": category,
        "rating": rating,
    }


# ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

def scrape_google_maps(
    query: str,
    location: str,
    headless: bool = False,
    num_workers: int = 2,
    output_csv: str = "",
) -> list[dict]:
    """
    Two-phase scrape:
      Phase 1 — one browser collects all listing URLs (unchanged approach)
      Phase 2 — N workers open each URL directly and extract details in parallel

    num_workers is capped at MAX_WORKERS (3) for safety.
    """
    num_workers = max(1, min(num_workers, MAX_WORKERS))
    print(f"\n⚡ Running with {num_workers} parallel worker(s)  [max safe = {MAX_WORKERS}]\n")

    # ── Phase 1: collect URLs ─────────────────────────────────────────────────
    listing_urls = collect_listing_urls(query, location, headless)

    if not listing_urls:
        print("⚠️  No listing URLs found — nothing to extract.")
        return []

    print(f"📋 {len(listing_urls)} URLs queued for extraction\n")
    print("─" * 50)
    print(f"⚡ [Phase 2] Starting {num_workers} extraction worker(s)...")
    print("─" * 50)

    # ── Phase 2: parallel detail extraction ──────────────────────────────────
    url_queue    = queue.Queue()
    results_list : list[dict]      = []
    results_lock = threading.Lock()
    csv_lock     = threading.Lock()
    stop_event   = threading.Event()

    for url in listing_urls:
        url_queue.put(url)

    threads = []
    for i in range(num_workers):
        t = threading.Thread(
            target=worker_extract,
            args=(i, url_queue, results_list, results_lock, output_csv, csv_lock, headless, stop_event),
            daemon=True,
            name=f"worker-{i}",
        )
        threads.append(t)
        t.start()

    # Wait for all work to finish (or stop signal)
    try:
        url_queue.join()
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted — stopping workers...")
        stop_event.set()

    stop_event.set()
    for t in threads:
        t.join(timeout=15)

    print(f"\n✅ Extraction complete — {len(results_list)} businesses extracted")
    return results_list


# ─── CSV EXPORT (final/full write — also used for filtered output) ─────────────

def export_csv(results: list[dict], output_path: str) -> str:
    fieldnames = ["name", "phone", "address", "website", "has_website", "category", "rating"]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BizScout - Google Maps business scraper (multithreaded)")
    parser.add_argument("--query",           required=True,       help='Business niche e.g. "food trucks"')
    parser.add_argument("--location",        required=True,       help='City e.g. "Sacramento, CA"')
    parser.add_argument("--output",          default="",          help="Output CSV filename (auto-generated if empty)")
    parser.add_argument("--headless",        action="store_true", help="Run browser headlessly (no window)")
    parser.add_argument("--no-website-only", action="store_true", dest="no_website_only",
                                                                   help="Only export businesses without a website")
    parser.add_argument("--workers",         type=int, default=2,
                                             help=f"Parallel extraction workers (1–{MAX_WORKERS}, default 2)")
    args = parser.parse_args()

    # Build output path early so workers can stream to it live
    if not args.output:
        slug = re.sub(r"[^a-z0-9]+", "_", f"{args.query}_{args.location}".lower()).strip("_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        args.output = f"{slug}_{timestamp}.csv"

    results = scrape_google_maps(
        args.query,
        args.location,
        headless=args.headless,
        num_workers=args.workers,
        output_csv=args.output,
    )

    if args.no_website_only:
        results = [r for r in results if not r["website"]]

    if not results:
        print("\n⚠️  No results to save.")
        return

    # Re-write the CSV with the (possibly filtered) final results
    export_csv(results, args.output)

    no_website = [r for r in results if not r["website"]]
    print(f"\n{'─'*50}")
    print(f"✅ Total scraped  : {len(results)}")
    print(f"🚫 No website     : {len(no_website)}")
    print(f"🌐 Has website    : {len(results) - len(no_website)}")
    print(f"💾 Saved to       : {args.output}")
    print(f"{'─'*50}\n")


if __name__ == "__main__":
    main()