"""
BizScout - Google Maps Scraper (Multithreaded)
Scrapes Google Maps for businesses by niche + city, extracts
name, phone, address, website status, review count, business age, and exports to CSV.
"""

import sys
from typing import Optional

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

DELAY_BETWEEN_CLICKS  = (1.5, 3.5)
DELAY_BETWEEN_SCROLLS = (0.8, 2.0)
DELAY_AFTER_LOAD      = (3.0, 5.0)
WORKER_STAGGER_DELAY  = (4.0, 8.0)
MAX_WORKERS = 3
MAX_RESULTS = 30

# High-urgency niches — businesses that need a website most
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
        driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    else:
        driver = webdriver.Chrome(options=options)
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
        ActionChains(driver).move_by_offset(random.randint(-50, 50), random.randint(-50, 50)).perform()
    except Exception:
        pass


# ─── PHASE 1: COLLECT LISTING URLS ───────────────────────────────────────────

def collect_listing_urls(query: str, location: str, headless: bool) -> list:
    search_term = f"{query} in {location}"
    url = f"https://www.google.com/maps/search/{quote_plus(search_term)}"
    print(f"🔍 Query    : {search_term}")
    print(f"🌐 URL      : {url}\n")
    print("🚀 [Phase 1] Starting collection browser...")

    driver = build_driver(headless=headless)
    urls = []

    try:
        print("📡 Loading Google Maps...")
        driver.get(url)
        human_delay(DELAY_AFTER_LOAD)
        print("✅ Page loaded\n")

        for btn_text in ["Accept all", "I agree", "Reject all", "Accept"]:
            try:
                btn = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{btn_text}')]")))
                btn.click()
                print(f"✅ Dismissed consent banner: '{btn_text}'")
                human_delay((1, 2))
                break
            except Exception:
                pass

        print("⏳ Waiting for results sidebar...")
        try:
            sidebar = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='feed']")))
            print("✅ Sidebar found\n")
        except Exception:
            print("❌ Could not find results sidebar — possible CAPTCHA or no results.")
            return []

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
                end_el = driver.find_element(By.XPATH, "//*[contains(text(), \"You've reached the end\")]")
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

def worker_extract(worker_id, url_queue, results_list, results_lock, csv_path, csv_lock, headless, stop_event):
    if worker_id > 0:
        stagger = random.uniform(*WORKER_STAGGER_DELAY) * worker_id
        print(f"  [W{worker_id}] Waiting {stagger:.1f}s before starting...")
        time.sleep(stagger)

    if stop_event.is_set():
        return

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
                human_delay(DELAY_BETWEEN_CLICKS)
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "h1.DUwDvf, h1[class*='fontHeadline'], div.fontHeadlineLarge"))
                )
                html = driver.page_source
                data = parse_listing_detail(html)
                move_mouse_randomly(driver)

                if data["name"]:
                    with results_lock:
                        results_list.append(data)
                    with csv_lock:
                        _append_csv_row(csv_path, data)
                    tag = "🚫 no website" if not data["website"] else "🌐 has website"
                    print(f" {data['name']} — {tag} — age:{data['business_age_years']}yr reviews:{data['review_count']}")
                else:
                    print(" skipped (no name)")

            except Exception as e:
                print(f"  [W{worker_id}] ⚠️  {str(e)[:80]}")
            finally:
                url_queue.task_done()

            human_delay((0.5, 1.2))

    except Exception as e:
        print(f"  [W{worker_id}] ❌ Fatal: {e}")
    finally:
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
        print(f"  [W{worker_id}] 🔒 Browser closed")


def _append_csv_row(csv_path: str, row: dict) -> None:
    fieldnames = ["name", "phone", "address", "website", "has_website", "category", "rating", "review_count", "business_age_years"]
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

    # ── Name ──────────────────────────────────────────────────────────────────
    name = ""
    for selector in [
        lambda s: s.find("h1", class_=lambda c: c and "DUwDvf" in c),
        lambda s: s.find("h1"),
    ]:
        el = selector(soup)
        if el:
            name = el.get_text(strip=True)
            break

    # ── Phone ─────────────────────────────────────────────────────────────────
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

    # ── Address ───────────────────────────────────────────────────────────────
    address = ""
    for btn in soup.find_all("button"):
        label = btn.get("aria-label", "")
        if re.search(r"\d+\s+\w+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pkwy|Hwy)", label, re.I):
            address = label.replace("Address: ", "").strip()
            break

    # ── Website ───────────────────────────────────────────────────────────────
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

    # ── Category ──────────────────────────────────────────────────────────────
    category = ""
    cat_el = soup.find("button", class_=lambda c: c and "DkEaL" in str(c))
    if cat_el:
        category = cat_el.get_text(strip=True)

    # ── Rating ────────────────────────────────────────────────────────────────
    rating = ""
    rating_el = soup.find("div", class_=lambda c: c and "F7nice" in str(c))
    if rating_el:
        spans = rating_el.find_all("span")
        if spans:
            rating = spans[0].get_text(strip=True)

    # ── Review count ──────────────────────────────────────────────────────────
    # Google Maps shows review count in multiple places — try each
    review_count = 0
    # Pattern 1: aria-label like "1,234 reviews"
    for el in soup.find_all(attrs={"aria-label": True}):
        label = el.get("aria-label", "")
        m = re.search(r"([\d,]+)\s+review", label, re.I)
        if m:
            try:
                review_count = int(m.group(1).replace(",", ""))
                break
            except ValueError:
                pass
    # Pattern 2: text node like "(1,234)"
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

    # ── Business age — oldest review year ─────────────────────────────────────
    # Google Maps embeds review dates in various formats:
    # "2 years ago", "3 months ago", "January 2018", "2018", etc.
    business_age_years = 0
    current_year = datetime.now().year
    oldest_year_found = current_year

    # Pattern 1: explicit year like "2015" or "January 2015"
    full_text = soup.get_text()
    year_matches = re.findall(r'\b(20\d{2}|19\d{2})\b', full_text)
    for y in year_matches:
        yr = int(y)
        if 1990 <= yr <= current_year:
            oldest_year_found = min(oldest_year_found, yr)

    # Pattern 2: "X years ago" — convert to approximate year
    years_ago_matches = re.findall(r'(\d+)\s+years?\s+ago', full_text, re.I)
    for ya in years_ago_matches:
        approx_year = current_year - int(ya)
        if 1990 <= approx_year <= current_year:
            oldest_year_found = min(oldest_year_found, approx_year)

    # Only set age if we found something older than this year
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

def scrape_google_maps(query: str, location: str, headless: bool = False, num_workers: int = 2, output_csv: str = "") -> list:
    num_workers = max(1, min(num_workers, MAX_WORKERS))
    print(f"\n⚡ Running with {num_workers} parallel worker(s)  [max safe = {MAX_WORKERS}]\n")

    listing_urls = collect_listing_urls(query, location, headless)
    if not listing_urls:
        print("⚠️  No listing URLs found — nothing to extract.")
        return []

    print(f"📋 {len(listing_urls)} URLs queued for extraction\n")
    print("─" * 50)
    print(f"⚡ [Phase 2] Starting {num_workers} extraction worker(s)...")
    print("─" * 50)

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
        print("\n⚠️  Interrupted — stopping workers...")
        stop_event.set()

    stop_event.set()
    for t in threads:
        t.join(timeout=15)

    print(f"\n✅ Extraction complete — {len(results_list)} businesses extracted")
    return results_list


# ─── CSV EXPORT ───────────────────────────────────────────────────────────────

def export_csv(results: list, output_path: str) -> str:
    fieldnames = ["name", "phone", "address", "website", "has_website", "category", "rating", "review_count", "business_age_years"]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BizScout - Google Maps business scraper (multithreaded)")
    parser.add_argument("--query",           required=True)
    parser.add_argument("--location",        required=True)
    parser.add_argument("--output",          default="")
    parser.add_argument("--headless",        action="store_true")
    parser.add_argument("--no-website-only", action="store_true", dest="no_website_only")
    parser.add_argument("--workers",         type=int, default=2)
    args = parser.parse_args()

    if not args.output:
        slug = re.sub(r"[^a-z0-9]+", "_", f"{args.query}_{args.location}".lower()).strip("_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        args.output = f"{slug}_{timestamp}.csv"

    results = scrape_google_maps(args.query, args.location, headless=args.headless, num_workers=args.workers, output_csv=args.output)

    if args.no_website_only:
        results = [r for r in results if not r["website"]]

    if not results:
        print("\n⚠️  No results to save.")
        return

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