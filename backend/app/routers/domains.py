# app/routers/domains.py
"""
BizScout — Domain Availability Checker
Uses GoDaddy API v1 to check domain availability and pricing.

Required env vars:
  GODADDY_API_KEY     — from developer.godaddy.com
  GODADDY_API_SECRET  — from developer.godaddy.com

Get your keys at: https://developer.godaddy.com/keys
Use "Production" keys (not OTE/test) for real results.
"""

import os
import re
import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/domains", tags=["domains"])

GODADDY_API_URL = "https://api.godaddy.com/v1"

TLDS = ["com", "net", "org", "co", "io", "info"]

PRICE_FALLBACKS = {
    "com":  12.99,
    "net":  12.99,
    "org":  12.99,
    "co":   8.99,
    "io":   39.99,
    "info": 5.99,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _headers() -> dict:
    key    = os.getenv("GODADDY_API_KEY", "")
    secret = os.getenv("GODADDY_API_SECRET", "")
    if not key or not secret:
        raise HTTPException(
            status_code=500,
            detail="GoDaddy API not configured. Set GODADDY_API_KEY and GODADDY_API_SECRET in backend/.env",
        )
    return {
        "Authorization": f"sso-key {key}:{secret}",
        "Accept":        "application/json",
    }


def _slugify(name: str) -> str:
    name = name.lower().strip()
    noise = {
        "the", "a", "an", "and", "or", "of", "for", "in", "at", "by",
        "llc", "inc", "co", "corp", "ltd", "services", "service",
        "solutions", "group", "company", "enterprises", "shop",
    }
    words = re.sub(r"[^a-z0-9\s]", "", name).split()
    filtered = [w for w in words if w not in noise] or words
    slug = "-".join(filtered)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:63]


def _generate_variants(slug: str) -> list:
    clean = slug.replace("-", "")
    words = slug.split("-")

    variants = [slug]
    if clean != slug and len(clean) >= 2:
        variants.append(clean)
    if len(words) > 1:
        variants.append(words[0])
    if len(words) >= 1:
        variants.append(f"{words[0]}pro")
        variants.append(f"get{clean}")

    seen, result = set(), []
    for v in variants:
        if v not in seen and len(v) >= 2:
            seen.add(v)
            result.append(v)
    return result[:5]


def _check_single(domain: str) -> dict:
    try:
        resp = requests.get(
            f"{GODADDY_API_URL}/domains/available",
            params={"domain": domain, "checkType": "FAST", "forTransfer": "false"},
            headers=_headers(),
            timeout=10,
        )
    except requests.RequestException as e:
        return {"domain": domain, "available": False, "price": None, "error": str(e)}

    if resp.status_code == 422:
        return {"domain": domain, "available": False, "price": None, "error": "invalid"}
    if resp.status_code not in (200, 203):
        return {"domain": domain, "available": False, "price": None, "error": f"HTTP {resp.status_code}"}

    data      = resp.json()
    available = data.get("available", False)
    tld       = domain.split(".")[-1]

    raw_price = data.get("price")
    if raw_price is not None:
        try:
            price = float(raw_price)
            if price > 1000:
                price = price / 1_000_000
        except (ValueError, TypeError):
            price = PRICE_FALLBACKS.get(tld, 12.99)
    else:
        price = PRICE_FALLBACKS.get(tld, 12.99)

    buy_url = (
        f"https://www.godaddy.com/domainsearch/find?domainToCheck={domain}"
        if available else None
    )

    return {
        "domain":    domain,
        "tld":       f".{tld}",
        "available": available,
        "price":     round(price, 2),
        "currency":  "USD",
        "buy_url":   buy_url,
        "error":     None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/check")
def check_domains(
    name: str = Query(..., description="Business name or domain slug to check"),
):
    slug = _slugify(name)
    if len(slug) < 2:
        raise HTTPException(status_code=422, detail="Business name too short to generate domain suggestions.")

    variants = _generate_variants(slug)

    grouped = []
    for variant in variants:
        tld_results = []
        for tld in TLDS:
            result = _check_single(f"{variant}.{tld}")
            tld_results.append(result)

        tld_results.sort(
            key=lambda x: (
                not x.get("available", False),
                TLDS.index(x["tld"].lstrip(".")) if x.get("tld", "").lstrip(".") in TLDS else 99,
            )
        )
        grouped.append({"name": variant, "results": tld_results})

    return {"query": name, "slug": slug, "variants": grouped}


@router.get("/suggest")
def suggest_names(name: str = Query(...)):
    slug     = _slugify(name)
    variants = _generate_variants(slug)
    return {"slug": slug, "variants": variants}