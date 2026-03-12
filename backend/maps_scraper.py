"""
BizScout - Google Maps Scraper
Scrapes Google Maps for businesses by niche + city, extracts
name, phone, address, website status, and exports to CSV.

Usage:
    python maps_scraper.py --query "food trucks" --location "Sacramento, CA"
    python maps_scraper.py --query "hair salons" --location "Elk Grove, CA" --no-website-only
    python maps_scraper.py --query "auto repair" --location "Roseville, CA" --output leads.csv --headless
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
import random
import re
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
]

DELAY_BETWEEN_CLICKS  = (1.5, 3.5)
DELAY_BETWEEN_SCROLLS = (0.8, 2.0)
DELAY_AFTER_LOAD      = (3.0, 5.0)

MAX_RESULTS = 120  # Google Maps caps around 120 per search


# ─── DRIVER SETUP ─────────────────────────────────────────────────────────────

def build_driver(headless: bool = False) -> webdriver.Chrome:
    print("🚀 Starting Chrome...")
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

    # Patch out webdriver fingerprint
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        """
    })

    print("✅ Chrome started\n")
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


# ─── CORE SCRAPER ─────────────────────────────────────────────────────────────

def scrape_google_maps(query: str, location: str, headless: bool = False) -> list[dict]:
    search_term = f"{query} in {location}"
    url = f"https://www.google.com/maps/search/{quote_plus(search_term)}"

    print(f"🔍 Query    : {search_term}")
    print(f"🌐 URL      : {url}\n")

    driver = build_driver(headless=headless)
    results = []

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
            print("❌ Could not find results sidebar.")
            print("   Possible reasons:")
            print("   - Google showed a CAPTCHA")
            print("   - No results for this search")
            print("   - Page structure changed")
            print(f"\n   Current URL: {driver.current_url}")
            print(f"   Page title : {driver.title}")
            return []

        # Scroll to load all listings
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

        listings = driver.find_elements(By.CSS_SELECTOR, "div[role='feed'] > div > div > a")
        print(f" {len(listings)} listings found\n")

        if not listings:
            print("⚠️  No listings found in sidebar.")
            return []

        # Click each listing and extract details
        for i, listing in enumerate(listings):
            try:
                print(f"  [{i+1}/{len(listings)}] Extracting...", end="", flush=True)

                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", listing)
                human_delay((0.3, 0.8))
                listing.click()
                human_delay(DELAY_BETWEEN_CLICKS)

                # Wait for detail panel to open
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "h1.DUwDvf, h1[class*='fontHeadline'], div.fontHeadlineLarge")
                    )
                )

                html = driver.page_source
                data = parse_listing_detail(html)

                if data["name"]:
                    results.append(data)
                    tag = "🚫 no website" if not data["website"] else "🌐 has website"
                    print(f" {data['name']} — {tag}")
                else:
                    print(" skipped (no name found)")

                move_mouse_randomly(driver)

            except Exception as e:
                print(f" ⚠️  error: {str(e)[:80]}")
                try:
                    back = driver.find_element(By.CSS_SELECTOR, "button[aria-label='Back']")
                    back.click()
                    human_delay((1, 2))
                except Exception:
                    pass
                continue

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")

    finally:
        driver.quit()
        print("\n🔒 Browser closed")

    return results


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


# ─── CSV EXPORT ───────────────────────────────────────────────────────────────

def export_csv(results: list[dict], output_path: str) -> str:
    fieldnames = ["name", "phone", "address", "website", "has_website", "category", "rating"]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return output_path


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BizScout - Google Maps business scraper")
    parser.add_argument("--query",           required=True,       help='Business niche e.g. "food trucks"')
    parser.add_argument("--location",        required=True,       help='City e.g. "Sacramento, CA"')
    parser.add_argument("--output",          default="",          help="Output CSV filename (auto-generated if empty)")
    parser.add_argument("--headless",        action="store_true", help="Run browser headlessly (no window)")
    parser.add_argument("--no-website-only", action="store_true", dest="no_website_only",
                                                                   help="Only export businesses without a website")
    args = parser.parse_args()

    results = scrape_google_maps(args.query, args.location, headless=args.headless)

    if args.no_website_only:
        results = [r for r in results if not r["website"]]

    if not results:
        print("\n⚠️  No results to save.")
        return

    if not args.output:
        slug = re.sub(r"[^a-z0-9]+", "_", f"{args.query}_{args.location}".lower()).strip("_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        args.output = f"{slug}_{timestamp}.csv"

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