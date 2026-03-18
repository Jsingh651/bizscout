"""Shared email sending via Resend API."""
import os
import resend

def send_email(to: str, subject: str, html: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("[email] RESEND_API_KEY not set — skipping email")
        return False
    from_email = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
    resend.api_key = api_key
    try:
        resend.Emails.send({
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[email] send error: {e}")
        return False
