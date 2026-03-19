"""
BizScout - Google Maps Scraper (Multithreaded)
Scrapes Google Maps for businesses by niche + city, extracts
name, phone, address, website status, review count, business age, and exports to CSV.

Anti-detection improvements:
- Random delays between all actions
- Human-like mouse movements
- Random scroll amounts
- CAPTCHA / ban detection with clear error messages
- Rate limit detection
- Detailed error logging
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')

from typing import Optional
import logging

# ─── LOGGING SETUP ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger("bizscout")

try:
    from bs4 import BeautifulSoup
except ImportError:
    log.error("Missing: beautifulsoup4 — Run: pip install beautifulsoup4")
    sys.exit(1)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except ImportError:
    log.error("Missing: selenium — Run: pip install selenium")
    sys.exit(1)

try:
    from webdriver_manager.chrome import ChromeDriverManager
    from selenium.webdriver.chrome.service import Service as ChromeService
    HAS_WEBDRIVER_MANAGER = True
except ImportError:
    HAS_WEBDRIVER_MANAGER = False
    log.warning("webdriver-manager not found — will use system chromedriver")

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

log.info("All imports OK")


# ─── ANTI-DETECTION CONFIG ────────────────────────────────────────────────────

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]

# Slower, more human-like delays
DELAY_BETWEEN_CLICKS  = (2.0, 4.5)
DELAY_BETWEEN_SCROLLS = (1.0, 2.5)
DELAY_AFTER_LOAD      = (4.0, 7.0)
DELAY_BEFORE_SEARCH   = (1.5, 3.0)
WORKER_STAGGER_DELAY  = (6.0, 12.0)
MAX_WORKERS = 1   # Reduced from 4 — fewer parallel browsers = less detection
MAX_RESULTS = 200

# ─── DETECTION STRINGS ────────────────────────────────────────────────────────
# NOTE: Keep these tight. Overly broad strings (e.g. "try again later", "429")
# match normal Google Maps UI text and cause false-positive block detection.

CAPTCHA_SIGNALS = [
    "our systems have detected unusual traffic",
    "captcha",
    "i'm not a robot",
    "verify you're human",
    "unusual traffic from your computer",
    "please solve this puzzle",
    "recaptcha",
    "sorry, we can't process your request",
]

# Deliberately narrow — do NOT add "try again later" or bare "429"
# as these appear in normal Maps listing pages
RATE_LIMIT_SIGNALS = [
    "too many requests",
    "rate limit exceeded",
    "quota exceeded",
]

BLOCK_SIGNALS = [
    "access denied",
    "403 forbidden",
    "your ip has been blocked",
    "this page isn't available",
]

HIGH_URGENCY_NICHES = {
    "restaurant", "food truck", "cafe", "bakery", "pizza", "sushi", "mexican",
    "chinese", "thai", "indian", "italian", "burger", "sandwich", "catering",
    "auto repair", "auto body", "mechanic", "plumber", "plumbing", "hvac",
    "roofing", "roofer", "landscaping", "lawn care", "electrician", "contractor",
    "hair salon", "barbershop", "barber", "nail salon", "spa", "massage",
    "dentist", "chiropractor", "veterinarian", "vet", "pet grooming",
    "cleaning service", "maid", "pest control", "tree service",
}


# ─── DRIVER SETUP ─────────────────────────────────────────────────────────────

def build_driver(headless: bool = False, user_data_dir: Optional[str] = None) -> webdriver.Chrome:
    import os as _os2
    # On Railway/server (no DISPLAY), force headless automatically
    if not headless and not _os2.environ.get("DISPLAY") and _os2.environ.get("RAILWAY_ENVIRONMENT"):
        headless = True
        log.info("Server environment detected — enabling headless mode")

    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--start-maximized")

    # Pick a random user agent
    ua = random.choice(USER_AGENTS)
    options.add_argument(f"--user-agent={ua}")
    log.info(f"Using user agent: {ua[:60]}...")

    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")

    # Extra stealth flags
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-features=VizDisplayCompositor")
    options.add_argument("--lang=en-US,en;q=0.9")

    options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("prefs", {
        "credentials_enable_service": False,
        "profile.password_manager_enabled": False,
        "profile.default_content_setting_values.notifications": 2,
        "intl.accept_languages": "en-US,en",
    })

    # Use system chromium on Railway/Linux, otherwise fall back to webdriver-manager
    import shutil, os as _os
    MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    system_chrome = (
        _os.getenv("CHROME_BIN")
        or shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
        or (MAC_CHROME if _os.path.exists(MAC_CHROME) else None)
    )
    system_driver = _os.getenv("CHROMEDRIVER_BIN") or shutil.which("chromedriver")
    if system_chrome:
        options.binary_location = system_chrome
    if system_driver:
        driver = webdriver.Chrome(service=ChromeService(system_driver), options=options)
    elif HAS_WEBDRIVER_MANAGER:
        driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    else:
        driver = webdriver.Chrome(options=options)

    # Deep stealth — override navigator properties
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            // Remove webdriver flag
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Fake plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const arr = [1, 2, 3, 4, 5];
                    arr.__proto__ = PluginArray.prototype;
                    return arr;
                }
            });

            // Fake languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Fake hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });

            // Fake device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });

            // Fake Chrome object
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Fake permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Remove automation-related properties
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        """
    })

    return driver


# ─── DETECTION CHECKER ────────────────────────────────────────────────────────

def check_for_blocks(driver) -> Optional[str]:
    """
    Check the current page for CAPTCHA, rate limits, or IP blocks.
    Returns an error string if detected, None if page looks clean.

    IMPORTANT: Only runs rate-limit checks on non-listing pages to avoid
    false positives from normal Maps UI text.
    """
    try:
        current_url = driver.current_url.lower()
        page_text   = driver.page_source.lower()
        page_title  = driver.title.lower()

        # Always check for CAPTCHA regardless of URL
        for signal in CAPTCHA_SIGNALS:
            if signal in page_text or signal in page_title:
                return f"CAPTCHA detected — Google flagged this browser as a bot. Signal: '{signal}'"

        # Only check rate-limit signals when NOT on a normal Maps listing/search page.
        # Maps listing pages contain benign text that can false-match broad signals.
        is_maps_page = (
            "/maps/place/" in current_url
            or "/maps/search/" in current_url
            or "maps.google.com" in current_url
            or "google.com/maps" in current_url
        )
        if not is_maps_page:
            for signal in RATE_LIMIT_SIGNALS:
                if signal in page_text or signal in page_title:
                    return (
                        f"Rate limit detected — too many requests. "
                        f"Signal: '{signal}'. Wait 1-2h before scraping again."
                    )

        for signal in BLOCK_SIGNALS:
            if signal in page_text or signal in page_title:
                return f"IP block detected — Google has blocked this IP. Signal: '{signal}'. Try a VPN or wait 24-48h."

        # Check for redirect to google.com/sorry
        if "google.com/sorry" in current_url or "google.com/recaptcha" in current_url:
            return f"Redirected to CAPTCHA page: {current_url}. Your IP may be temporarily blocked by Google."

        return None

    except Exception as e:
        log.warning(f"Could not check for blocks: {e}")
        return None


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def human_delay(range_tuple: tuple) -> None:
    """Sleep for a random human-like duration."""
    delay = random.uniform(*range_tuple)
    # Occasionally add a longer pause to simulate reading/thinking
    if random.random() < 0.1:
        delay += random.uniform(1.0, 3.0)
    time.sleep(delay)

def human_scroll(driver, element, pixels: int = 300) -> None:
    """Scroll with randomized amount and speed."""
    amount = pixels + random.randint(-100, 150)
    driver.execute_script("arguments[0].scrollTop += arguments[1];", element, amount)
    human_delay(DELAY_BETWEEN_SCROLLS)

def move_mouse_randomly(driver) -> None:
    """Move mouse to a random position to simulate human behavior."""
    try:
        x = random.randint(-100, 100)
        y = random.randint(-100, 100)
        ActionChains(driver).move_by_offset(x, y).perform()
        if random.random() < 0.3:
            time.sleep(random.uniform(0.2, 0.5))
            ActionChains(driver).move_by_offset(
                random.randint(-50, 50),
                random.randint(-50, 50)
            ).perform()
    except Exception:
        pass

def random_pause_like_human():
    """Occasionally take a longer break like a human would."""
    if random.random() < 0.05:
        pause = random.uniform(3.0, 8.0)
        log.info(f"Taking a human-like pause of {pause:.1f}s...")
        time.sleep(pause)


# ─── PHASE 1: COLLECT LISTING URLS ───────────────────────────────────────────

def collect_listing_urls(query: str, location: str, headless: bool) -> list:
    search_term = f"{query} in {location}"
    url = f"https://www.google.com/maps/search/{quote_plus(search_term)}"
    log.info(f"Query    : {search_term}")
    log.info(f"URL      : {url}")
    log.info("[Phase 1] Starting collection browser...")

    driver = build_driver(headless=headless)
    urls = []

    try:
        human_delay(DELAY_BEFORE_SEARCH)

        log.info("Loading Google Maps...")
        driver.get(url)
        human_delay(DELAY_AFTER_LOAD)
        log.info("Page loaded")

        # Check for blocks immediately after load
        block = check_for_blocks(driver)
        if block:
            log.error(f"BLOCKED ON LOAD: {block}")
            print(f"\n{'='*60}")
            print(f"ERROR: {block}")
            print(f"{'='*60}\n")
            return []

        # Dismiss consent banners
        for btn_text in ["Accept all", "I agree", "Reject all", "Accept"]:
            try:
                btn = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{btn_text}')]"))
                )
                btn.click()
                log.info(f"Dismissed consent banner: '{btn_text}'")
                human_delay((1.5, 3.0))
                break
            except Exception:
                pass

        # Check again after dismissing banners
        block = check_for_blocks(driver)
        if block:
            log.error(f"BLOCKED AFTER CONSENT: {block}")
            print(f"\n{'='*60}")
            print(f"ERROR: {block}")
            print(f"{'='*60}\n")
            return []

        log.info("Waiting for results sidebar...")
        try:
            sidebar = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed']"))
            )
            log.info("Sidebar found")
        except Exception:
            block = check_for_blocks(driver)
            if block:
                log.error(f"BLOCKED — NO SIDEBAR: {block}")
                print(f"\n{'='*60}")
                print(f"ERROR: {block}")
                print(f"{'='*60}\n")
            else:
                log.warning("Could not find results sidebar — possible CAPTCHA or no results for this search.")
                log.warning(f"Current URL: {driver.current_url}")
                log.warning(f"Page title: {driver.title}")
            return []

        log.info("Scrolling to load all results...")
        last_count = 0
        stale_rounds = 0
        scroll_count = 0

        while True:
            listings = driver.find_elements(By.CSS_SELECTOR, "div[role='feed'] > div > div > a")
            current_count = len(listings)
            log.info(f"  Found {current_count} listings so far...")

            if current_count >= MAX_RESULTS:
                log.info(f"Reached max results ({MAX_RESULTS})")
                break

            try:
                end_el = driver.find_element(
                    By.XPATH, "//*[contains(text(), \"You've reached the end\")]"
                )
                if end_el:
                    log.info("Reached end of results")
                    break
            except Exception:
                pass

            if current_count == last_count:
                stale_rounds += 1
                log.info(f"  No new listings (stale round {stale_rounds}/5)")
                if stale_rounds >= 5:
                    log.info("Scrolled to bottom — no more results loading")
                    break
            else:
                stale_rounds = 0

            last_count = current_count
            scroll_count += 1

            human_scroll(driver, sidebar, pixels=400)
            move_mouse_randomly(driver)
            random_pause_like_human()

            # Periodically check for blocks mid-scroll
            if scroll_count % 5 == 0:
                block = check_for_blocks(driver)
                if block:
                    log.error(f"BLOCKED DURING SCROLL: {block}")
                    print(f"\n{'='*60}")
                    print(f"ERROR: {block}")
                    print(f"{'='*60}\n")
                    break

        listings = driver.find_elements(By.CSS_SELECTOR, "div[role='feed'] > div > div > a")
        for a in listings:
            href = a.get_attribute("href")
            if href and "/maps/place/" in href:
                urls.append(href)

        log.info(f"Phase 1 complete — {len(urls)} listing URLs collected")

    except Exception as e:
        log.error(f"Phase 1 error: {e}", exc_info=True)
    finally:
        driver.quit()
        log.info("Collection browser closed")

    return urls


# ─── PHASE 2: PARALLEL DETAIL EXTRACTION ─────────────────────────────────────

def worker_extract(worker_id, url_queue, results_list, results_lock, csv_path, csv_lock, headless, stop_event):
    if worker_id > 0:
        stagger = random.uniform(*WORKER_STAGGER_DELAY) * worker_id
        log.info(f"  [W{worker_id}] Waiting {stagger:.1f}s before starting...")
        time.sleep(stagger)

    if stop_event.is_set():
        return

    profile_dir = tempfile.mkdtemp(prefix=f"bizscout_w{worker_id}_")
    driver = None
    consecutive_errors = 0
    block_detected = False

    try:
        log.info(f"  [W{worker_id}] Starting browser (isolated profile)...")
        driver = build_driver(headless=headless, user_data_dir=profile_dir)
        log.info(f"  [W{worker_id}] Browser ready")

        while not stop_event.is_set():
            try:
                place_url = url_queue.get(timeout=3)
            except queue.Empty:
                break

            try:
                log.info(f"  [W{worker_id}] Loading listing...")
                driver.get(place_url)
                human_delay(DELAY_BETWEEN_CLICKS)

                block = check_for_blocks(driver)
                if block:
                    log.error(f"  [W{worker_id}] BLOCKED ON LISTING: {block}")
                    block_detected = True
                    stop_event.set()
                    url_queue.task_done()
                    break

                WebDriverWait(driver, 12).until(
                    EC.presence_of_element_located((
                        By.CSS_SELECTOR,
                        "h1.DUwDvf, h1[class*='fontHeadline'], div.fontHeadlineLarge"
                    ))
                )

                html = driver.page_source
                data = parse_listing_detail(html)
                move_mouse_randomly(driver)
                random_pause_like_human()

                if data["name"]:
                    with results_lock:
                        results_list.append(data)
                    with csv_lock:
                        _append_csv_row(csv_path, data)
                    tag = "NO website" if not data["website"] else "has website"
                    log.info(f"  [W{worker_id}] ✓ {data['name']} — {tag} — {data['review_count']} reviews")
                    consecutive_errors = 0
                else:
                    log.warning(f"  [W{worker_id}] Skipped listing — no name found")

            except Exception as e:
                consecutive_errors += 1
                log.warning(f"  [W{worker_id}] Error on listing: {str(e)[:120]}")

                if consecutive_errors >= 3:
                    log.warning(f"  [W{worker_id}] {consecutive_errors} consecutive errors — checking for block...")
                    try:
                        block = check_for_blocks(driver)
                        if block:
                            log.error(f"  [W{worker_id}] BLOCKED: {block}")
                            block_detected = True
                            stop_event.set()
                            url_queue.task_done()
                            break
                    except Exception:
                        pass

                    if consecutive_errors >= 8:
                        log.error(f"  [W{worker_id}] Too many errors — stopping this worker")
                        url_queue.task_done()
                        break

            finally:
                try:
                    url_queue.task_done()
                except Exception:
                    pass

            delay = random.uniform(1.5, 4.0)
            if random.random() < 0.1:
                delay += random.uniform(3.0, 8.0)
            time.sleep(delay)

    except Exception as e:
        log.error(f"  [W{worker_id}] FATAL: {e}", exc_info=True)
    finally:
        if block_detected:
            log.error(f"  [W{worker_id}] Worker stopped due to Google block/CAPTCHA detection")
            print(f"\n{'='*60}")
            print(f"WARNING: Google may have temporarily blocked your IP.")
            print(f"Recommendations:")
            print(f"  1. Wait 2-4 hours before scraping again")
            print(f"  2. Try a different network (mobile hotspot)")
            print(f"  3. Scrape smaller batches (20-30 leads at a time)")
            print(f"  4. Increase delays between searches")
            print(f"{'='*60}\n")
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        try:
            import shutil
            shutil.rmtree(profile_dir, ignore_errors=True)
        except Exception:
            pass
        log.info(f"  [W{worker_id}] Browser closed")


def _append_csv_row(csv_path: str, row: dict) -> None:
    fieldnames = [
        "name", "phone", "address", "website", "has_website",
        "category", "rating", "review_count", "business_age_years"
    ]
    file_exists = os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in fieldnames})


# ─── PARSE LISTING DETAIL ─────────────────────────────────────────────────────

def parse_listing_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    phone_re = re.compile(r"\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}")

    name = ""
    for selector in [
        lambda s: s.find("h1", class_=lambda c: c and "DUwDvf" in c),
        lambda s: s.find("h1"),
    ]:
        el = selector(soup)
        if el:
            name = el.get_text(strip=True)
            break

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

    address = ""
    for btn in soup.find_all("button"):
        label = btn.get("aria-label", "")
        if re.search(r"\d+\s+\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pkwy|Hwy)", label, re.I):
            address = label.replace("Address: ", "").strip()
            break

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
            if "website" in label.lower() and href.startswith("http") and "google.com" not in href:
                website = href
                break

    category = ""
    cat_el = soup.find("button", class_=lambda c: c and "DkEaL" in str(c))
    if cat_el:
        category = cat_el.get_text(strip=True)

    rating = ""
    rating_el = soup.find("div", class_=lambda c: c and "F7nice" in str(c))
    if rating_el:
        spans = rating_el.find_all("span")
        if spans:
            rating = spans[0].get_text(strip=True)

    review_count = 0
    for el in soup.find_all(attrs={"aria-label": True}):
        label = el.get("aria-label", "")
        m = re.search(r"([\d,]+)\s+review", label, re.I)
        if m:
            try:
                review_count = int(m.group(1).replace(",", ""))
                break
            except ValueError:
                pass
    if not review_count:
        text = soup.get_text()
        m = re.search(r"\(([\d,]+)\)", text)
        if m:
            try:
                candidate = int(m.group(1).replace(",", ""))
                if candidate > 0:
                    review_count = candidate
            except ValueError:
                pass

    business_age_years = 0
    current_year = datetime.now().year
    oldest_year_found = current_year
    full_text = soup.get_text()

    year_matches = re.findall(r'\b(20\d{2}|19\d{2})\b', full_text)
    for y in year_matches:
        yr = int(y)
        if 1990 <= yr <= current_year:
            oldest_year_found = min(oldest_year_found, yr)

    years_ago_matches = re.findall(r'(\d+)\s+years?\s+ago', full_text, re.I)
    for ya in years_ago_matches:
        approx_year = current_year - int(ya)
        if 1990 <= approx_year <= current_year:
            oldest_year_found = min(oldest_year_found, approx_year)

    if oldest_year_found < current_year:
        business_age_years = current_year - oldest_year_found

    return {
        "name":               name,
        "phone":              phone,
        "address":            address,
        "website":            website,
        "has_website":        "Yes" if website else "No",
        "category":           category,
        "rating":             rating,
        "review_count":       review_count,
        "business_age_years": business_age_years,
    }


# ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

def scrape_google_maps(
    query: str,
    location: str,
    headless: bool = False,
    num_workers: int = 2,
    output_csv: str = ""
) -> list:
    num_workers = max(1, min(num_workers, MAX_WORKERS))
    log.info(f"Running with {num_workers} worker(s) [max safe = {MAX_WORKERS}]")
    log.info("TIP: Keep workers at 1-2 to avoid Google rate limiting")

    listing_urls = collect_listing_urls(query, location, headless)
    if not listing_urls:
        log.error("No listing URLs found — check logs above for block/CAPTCHA messages")
        return []

    log.info(f"{len(listing_urls)} URLs queued for extraction")
    log.info(f"Starting {num_workers} extraction worker(s)...")

    url_queue    = queue.Queue()
    results_list = []
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

    try:
        url_queue.join()
    except KeyboardInterrupt:
        log.info("Interrupted — stopping workers...")
        stop_event.set()

    stop_event.set()
    for t in threads:
        t.join(timeout=15)

    log.info(f"Extraction complete — {len(results_list)} businesses extracted")
    return results_list


# ─── CSV EXPORT ───────────────────────────────────────────────────────────────

def export_csv(results: list, output_path: str) -> str:
    fieldnames = [
        "name", "phone", "address", "website", "has_website",
        "category", "rating", "review_count", "business_age_years"
    ]
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BizScout - Google Maps business scraper")
    parser.add_argument("--query",           required=True)
    parser.add_argument("--location",        required=True)
    parser.add_argument("--output",          default="")
    parser.add_argument("--headless",        action="store_true")
    parser.add_argument("--no-website-only", action="store_true", dest="no_website_only")
    parser.add_argument("--workers",         type=int, default=1)
    args = parser.parse_args()

    if not args.output:
        slug = re.sub(r"[^a-z0-9]+", "_", f"{args.query}_{args.location}".lower()).strip("_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        args.output = os.path.join(tempfile.gettempdir(), f"bizscout_{slug}_{timestamp}.csv")

    log.info(f"Output will be saved to: {args.output}")

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
        log.warning("No results to save.")
        return

    export_csv(results, args.output)

    no_website = [r for r in results if not r["website"]]
    log.info("=" * 50)
    log.info(f"Total scraped  : {len(results)}")
    log.info(f"No website     : {len(no_website)}")
    log.info(f"Has website    : {len(results) - len(no_website)}")
    log.info(f"Saved to       : {args.output}")
    log.info("=" * 50)


if __name__ == "__main__":
    main()