"""Shared email sending via Brevo HTTP API."""
import os
import requests


def send_email(to: str, subject: str, html: str) -> bool:
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        print("[email] BREVO_API_KEY not set — skipping email")
        return False
    from_email = os.getenv("FROM_EMAIL", "jasonsing02@gmail.com")
    try:
        resp = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json={
                "sender": {"email": from_email},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html,
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            print(f"[email] Brevo error {resp.status_code}: {resp.text}")
            return False
        return True
    except Exception as e:
        print(f"[email] send error: {e}")
        return False
