import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.lead import Lead
from app.models.meeting import Meeting
from app.models.user import User
from app.dependencies import get_current_user
from app.utils.hashids_util import decode_id, encode_id
from app.limiter import limiter


router = APIRouter(prefix="/meetings", tags=["meetings"])


class MeetingCreate(BaseModel):
    lead_id: int
    prospect_name: str
    email: EmailStr
    start_time: datetime  # ISO 8601 from the frontend (UTC or with timezone)
    duration_minutes: Optional[int] = 30


class MeetingResponse(BaseModel):
    id: int
    lead_id: int
    prospect_name: Optional[str] = None
    email: EmailStr
    start_time: datetime
    zoom_join_url: Optional[str] = None

    class Config:
        from_attributes = True


def _get_zoom_access_token() -> str:
    """
    Use Zoom Server-to-Server OAuth to fetch an access token.

    This works on a free Zoom account as long as the user creates a
    Server-to-Server OAuth app and provides these env vars:
      - ZOOM_ACCOUNT_ID
      - ZOOM_CLIENT_ID
      - ZOOM_CLIENT_SECRET
    """
    account_id = os.getenv("ZOOM_ACCOUNT_ID")
    client_id = os.getenv("ZOOM_CLIENT_ID")
    client_secret = os.getenv("ZOOM_CLIENT_SECRET")

    if not account_id or not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="Zoom API is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in backend/.env.",
        )

    token_url = "https://zoom.us/oauth/token"
    params = {"grant_type": "account_credentials", "account_id": account_id}

    try:
        resp = requests.post(token_url, params=params, auth=(client_id, client_secret), timeout=10)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach Zoom OAuth API: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Zoom OAuth error: {resp.text}")

    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="Zoom OAuth response missing access_token")
    return access_token


def _create_zoom_meeting(start_time: datetime, duration_minutes: int, topic: str) -> dict:
    """
    Create a Zoom meeting via API and return the JSON payload.
    """
    user_id = os.getenv("ZOOM_USER_ID") or "me"
    token = _get_zoom_access_token()

    # Zoom expects RFC3339 / ISO 8601 in UTC.
    if start_time.tzinfo is None:
        # Treat naive input as UTC to keep behaviour simple.
        start_iso = start_time.isoformat() + "Z"
    else:
        start_iso = (
            start_time.astimezone(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )

    url = f"https://api.zoom.us/v2/users/{user_id}/meetings"
    payload = {
        "topic": topic or "Website demo",
        "type": 2,  # scheduled meeting
        "start_time": start_iso,
        "duration": duration_minutes,
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
        },
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach Zoom Meetings API: {exc}") from exc

    if resp.status_code not in (201, 200):
        raise HTTPException(status_code=502, detail=f"Zoom meeting creation failed: {resp.text}")

    return resp.json()


def _add_zoom_registrant(meeting_id: str, email: str, name: str, token: str) -> None:
    """Optional: add registrant to Zoom. We send the invite ourselves via SMTP."""
    if not meeting_id or not email:
        return
    url = f"https://api.zoom.us/v2/meetings/{meeting_id}/registrants"
    first_name = (name or "Guest")[:64]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        requests.post(url, json={"email": email, "first_name": first_name}, headers=headers, timeout=10)
    except requests.RequestException:
        pass


def _invite_email_html(prospect_name: str, meeting_topic: str, start_time: datetime, join_url: str) -> str:
    """Professional HTML email template for the Zoom invite."""
    # Format time in a friendly way (e.g. "Wednesday, March 18, 2026 at 1:45 PM UTC")
    if start_time.tzinfo:
        start_dt = start_time.astimezone(timezone.utc)
    else:
        start_dt = start_time.replace(tzinfo=timezone.utc)
    time_str = start_dt.strftime("%A, %B %d, %Y at %I:%M %p UTC")

    first_name = (prospect_name or "there").strip().split()[0] if (prospect_name or "").strip() else "there"

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your demo meeting</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff; color: #333333;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
    <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="padding: 20px 24px 12px; text-align: left;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">Your demo meeting is scheduled</h1>
      </div>
      <div style="padding: 0 24px 24px;">
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">Hi {first_name},</p>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          Looking forward to showing you the <strong>website demo we prepared for your business.</strong>
        </p>
        <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          During the call I'll walk you through:
        </p>
        <ul style="margin: 0 0 16px 18px; padding: 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
          <li>How the new site will attract more customers</li>
          <li>The design and features built specifically for your business</li>
          <li>How quickly we can launch it for you</li>
        </ul>
        <div style="background: #f9fafb; border-radius: 10px; padding: 18px 20px; margin: 4px 0 20px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Meeting</p>
          <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #111827;">{meeting_topic}</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563;">{time_str}</p>
        </div>
        <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          Here's the Zoom link for our scheduled time:
        </p>
        <p style="margin: 0 0 20px; text-align: left;">
          <a href="{join_url}" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
            👉 Join the demo
          </a>
        </p>
        <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280; line-height: 1.5;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="{join_url}" style="color: #2563EB; word-break: break-all;">{join_url}</a>
        </p>
        <p style="margin: 0 0 14px; font-size: 14px; color: #4b5563; line-height: 1.6;">
          The demo only takes about <strong>10–15 minutes</strong>, and you'll get to see exactly how the site would look before deciding anything.
        </p>
        <p style="margin: 0 0 20px; font-size: 14px; color: #4b5563; line-height: 1.6;">
          If anything comes up, just reply here and we can easily reschedule.
        </p>
        <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
          Talk soon,<br>
          Jason
        </p>
      </div>
    </div>
  </div>
</body>
</html>
"""


def _send_invite_email(to_email: str, prospect_name: str, meeting_topic: str, start_time: datetime, join_url: str) -> None:
    """Send the Zoom invite email via SMTP. If SMTP is not configured, does nothing."""
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL") or user
    port = int(os.getenv("SMTP_PORT", "587"))

    if not host or not user or not password or not join_url:
        return

    html = _invite_email_html(prospect_name, meeting_topic, start_time, join_url)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your demo meeting: {meeting_topic}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_email, [to_email], msg.as_string())
    except Exception:
        pass


def _send_reminder_email(to_email: str, prospect_name: str, meeting_topic: str, start_time: datetime, join_url: str) -> bool:
    """Send a 10-minute reminder email. Returns True if sent, False otherwise."""
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    if not host or not user or not password or not join_url or not to_email:
        return False
    from_email = os.getenv("FROM_EMAIL") or user
    port = int(os.getenv("SMTP_PORT", "587"))

    # Ensure start_time is timezone-aware for template formatting
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    html = _invite_email_html(prospect_name, meeting_topic, start_time, join_url)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Reminder: your demo starts soon – {meeting_topic}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_email, [to_email], msg.as_string())
        return True
    except Exception:
        return False


def start_reminder_worker() -> None:
    """
    Launch a lightweight background loop that sends 10‑minute reminders.

    Runs every 30 seconds and looks for meetings where:
      - reminder_scheduled = True
      - reminder_sent_at IS NULL
      - start_time is 8–12 minutes from now (wider window so we don't miss)
    """
    import threading
    import time

    def _loop():
        while True:
            try:
                db = SessionLocal()
                now = datetime.now(timezone.utc)
                window_start = now + timedelta(minutes=8)
                window_end = now + timedelta(minutes=12)

                meetings = (
                    db.query(Meeting)
                    .filter(
                        Meeting.reminder_scheduled.is_(True),
                        Meeting.reminder_sent_at.is_(None),
                        Meeting.start_time >= window_start,
                        Meeting.start_time <= window_end,
                    )
                    .all()
                )

                for m in meetings:
                    try:
                        start_utc = m.start_time if m.start_time.tzinfo else m.start_time.replace(tzinfo=timezone.utc)
                        sent = _send_reminder_email(
                            to_email=m.email,
                            prospect_name=m.prospect_name or "",
                            meeting_topic="Website demo",
                            start_time=start_utc,
                            join_url=m.zoom_join_url or "",
                        )
                        if sent:
                            m.reminder_sent_at = now
                            m.reminder_scheduled = False
                    except Exception:
                        continue

                db.commit()
            except Exception:
                pass
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            time.sleep(30)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


@router.post("/", response_model=MeetingResponse)
@limiter.limit("200/minute")
def create_meeting(request: Request, body: MeetingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Schedule a Zoom meeting for a specific lead.

    - Verifies the lead exists.
    - Creates a Zoom meeting via API.
    - Persists the meeting record in the database.
    - Returns the meeting info (including join_url) to the frontend.
    """
    lead = db.query(Lead).filter(Lead.id == body.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Build a friendly meeting title: "Website demo – {name} ({city})"
    city_part = f" ({lead.city})" if lead.city else ""
    topic = f"Website demo – {lead.name}{city_part}" if lead.name else "Website demo"

    # Get token once so we can reuse it for meeting + registrant
    token = _get_zoom_access_token()
    zoom_data = _create_zoom_meeting(body.start_time, body.duration_minutes or 30, topic)

    zoom_meeting_id = zoom_data.get("id")
    try:
        _add_zoom_registrant(str(zoom_meeting_id), str(body.email), body.prospect_name or "", token)
    except Exception:
        pass

    join_url = zoom_data.get("join_url")

    m = Meeting(
        lead_id=body.lead_id,
        prospect_name=body.prospect_name.strip() or None,
        email=str(body.email),
        start_time=body.start_time,
        zoom_meeting_id=str(zoom_data.get("id", "")) if zoom_data.get("id") is not None else None,
        zoom_join_url=join_url,
        zoom_start_url=zoom_data.get("start_url"),
        reminder_scheduled=False,
        reminder_sent_at=None,
    )

    # Only schedule reminders for meetings at least 2 hours in the future
    now_utc = datetime.now(timezone.utc)
    start_utc = body.start_time if body.start_time.tzinfo else body.start_time.replace(tzinfo=timezone.utc)
    if start_utc - now_utc >= timedelta(hours=2):
        m.reminder_scheduled = True

    db.add(m)
    db.commit()
    db.refresh(m)

    # Send initial invite email ourselves (if SMTP is configured)
    if join_url:
        _send_invite_email(
            to_email=str(body.email),
            prospect_name=body.prospect_name or "",
            meeting_topic=topic,
            start_time=body.start_time,
            join_url=join_url,
        )

    return MeetingResponse.model_validate(m)


@router.get("/lead/{lead_id}", response_model=Optional[MeetingResponse])
@limiter.limit("200/minute")
def next_meeting_for_lead(request: Request, lead_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return the next upcoming meeting for a given lead, if any."""
    real_id = decode_id(lead_id)
    if real_id is None:
        return None
    now = datetime.now(timezone.utc)
    meeting = (
        db.query(Meeting)
        .filter(Meeting.lead_id == real_id, Meeting.start_time >= now)
        .order_by(Meeting.start_time.asc())
        .first()
    )
    if not meeting:
        return None
    return MeetingResponse.model_validate(meeting)


@router.get("/upcoming")
@limiter.limit("200/minute")
def upcoming_meetings(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Return all upcoming meetings (start_time >= now) with basic lead info.
    """
    now = datetime.now(timezone.utc)
    meetings = (
        db.query(Meeting, Lead)
        .join(Lead, Lead.id == Meeting.lead_id)
        .filter(Meeting.start_time >= now)
        .order_by(Meeting.start_time.asc())
        .all()
    )
    result = []
    for meeting, lead in meetings:
        result.append({
            "id": meeting.id,
            "lead_id": meeting.lead_id,
            "lead_hid": encode_id(meeting.lead_id) if meeting.lead_id else None,
            "prospect_name": meeting.prospect_name,
            "email": meeting.email,
            "start_time": meeting.start_time.isoformat(),
            "zoom_join_url": meeting.zoom_join_url,
            "lead": {
                "id": lead.id,
                "hid": encode_id(lead.id),
                "name": lead.name,
                "city": lead.city,
                "phone": lead.phone,
                "score": lead.score,
            },
        })
    return result

