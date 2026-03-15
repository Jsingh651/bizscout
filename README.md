# BizScout

AI-powered local business lead intelligence platform for website sales automation. Find businesses without websites, score and prioritize leads, manage your pipeline, schedule demos, and generate contracts.

**Stack:** React + Vite · FastAPI · PostgreSQL (Supabase) · SQLAlchemy · JWT Auth

---

## What the App Does So Far

- **Lead scraping** — Run Google Maps searches by niche and city; scrape business name, phone, address, rating, reviews, website status, category; store leads in the database with optional “no website only” filter.
- **Lead scoring** — Rule-based 0–100 score (no website, rating, review count, business age, category urgency, phone/address). Leads are sortable/filterable by score; Batches show avg score and “no website %.”
- **Leads dashboard** — List/filter leads by niche, city, website status; search; open lead detail with full info and score breakdown.
- **Pipeline (CRM board)** — Kanban-style stages: New Lead, Contacted, Interested, Proposal Sent, Closed Won, Closed Lost. Drag leads between stages.
- **Call outcome tracking** — On each lead you can set: Interested, Not Interested, Call Later, No Answer, Wrong Number (with timestamp).
- **Notes** — Per-lead notes on Lead Detail.
- **Demo scheduling** — From Lead Detail: enter prospect name + email, pick date/time; backend creates a Zoom meeting and (if SMTP configured) emails a professional invite with join link.
- **Meeting reminders** — Background worker sends Zoom reminder emails at 24 hours, 1 hour, and 10 minutes before each scheduled demo.
- **Meetings page** — List upcoming demos with join links.
- **Contract generator** — From Lead Detail, “Generate Contract” returns an HTML Service Agreement with lead + your profile data auto-filled; open in new tab to print or save as PDF.
- **Analytics** — Dashboard: total leads, batches, lead counts per batch; breakdowns by website status, niche, city; “no website” share.
- **Profile** — Update display name, change password, view recent activity, delete account.
- **Auth** — Register, login (cookie + optional Bearer token for contract), logout.

---

## Feature List (Done vs Planned)

| # | Feature | Status |
|---|---------|--------|
| 1 | **Lead Scraper** — Scrapes Google Maps for local businesses without websites; stores leads in DB | ✅ Done |
| 2 | **Lead Scoring** — Scores leads (reviews, category, etc.); High / Medium / Low priority | ✅ Done (rule-based 0–100) |
| 3 | **Automatic Call Queue (Power Dialer)** — One-click “Start Calling”; sequential calls; auto-advance on no answer; stop on answer | ⬜ Not done |
| 4 | **Call Outcome Buttons** — After each call: Interested, Not Interested, Call Later, No Answer, Wrong Number; each can trigger automations | ✅ Done (buttons + storage; no automations yet) |
| 5 | **Automated Follow-Up** — Day 1, Day 3, Day 7 follow-up emails when lead doesn’t respond | ⬜ Not done |
| 6 | **Demo Scheduling** — Enter email in dashboard; system creates Zoom meeting and emails link to prospect | ✅ Done |
| 7 | **Meeting Reminder Automation** — 24h, 1h, 10min reminders for scheduled demos | ✅ Done |
| 8 | **One-Click Demo Website Generator** — Generate sample homepage from business name, photos, services, reviews | ⬜ Not done |
| 9 | **Contract Generator** — Generate contract from lead; auto-fill name, company, address, email, phone; set build price, monthly price, scope, timeline | ✅ Done (basic: auto-fill from lead; no UI for price/scope/timeline) |
| 10 | **Electronic Signature** — Secure signing link; client signs; signed PDF stored in CRM | ⬜ Not done |
| 11 | **Automatic Invoice** — After contract signed, auto-send invoice + payment link | ⬜ Not done |
| 12 | **Sales Pipeline / CRM Board** — Stages: New Leads → Called → Interested → Demo Scheduled → Contract Sent → Closed | ✅ Done |
| 13 | **Analytics Dashboard** — Leads scraped, calls made, meetings booked, contracts sent, deals closed, revenue | ✅ Done (leads/batches/breakdowns; calls/contracts/revenue not yet) |
| 14 | **Domain Availability Checker** — Quick domain check during sales calls | ⬜ Not done |
| 15 | **Client Portal** — After purchase: login to view project progress, invoices, support, hosting status | ⬜ Not done |
| 16 | **Website Delivery Automation** — After payment: auto-create project, task checklist (e.g. collect logo, photos, theme, launch) | ⬜ Not done |

---

## Prerequisites

- **Node.js** v18+ → https://nodejs.org
- **Python** 3.9+ → https://www.python.org/downloads
- **Git** → https://git-scm.com
- **Supabase** account (free) → https://supabase.com

---

## 1. Clone the Repo

```bash
git clone https://github.com/jsingh651s/bizscout.git
cd bizscout
```

---

## 2. Supabase Setup

1. Create a project at https://supabase.com
2. **Settings → Database** → copy **Connection String** (URI):
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
3. The `leads`, `users`, `batches`, and `meetings` tables are created automatically on first backend run.

---

## 3. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
SECRET_KEY=your-long-random-secret-key-change-this-in-production
OPENAI_API_KEY=sk-your-openai-key-here
```

Optional for Zoom + email: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and SMTP vars (see `app/routers/meetings.py`).

Start backend:

```bash
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000 · Docs: http://127.0.0.1:8000/docs

---

## 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

---

## 5. Running the Full App

**Terminal 1 — Backend:**
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
```

Visit http://localhost:5173

---

## 6. Folder Structure

```
bizscout/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── NavbarDropdown.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Leads.jsx
│   │   │   ├── LeadDetail.jsx
│   │   │   ├── AddLead.jsx
│   │   │   ├── Batches.jsx
│   │   │   ├── Pipeline.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Meetings.jsx
│   │   │   └── Profile.jsx
│   │   ├── styles/
│   │   │   └── datepicker-overrides.css
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── maps_scraper.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── lead.py
│   │   │   ├── user.py
│   │   │   ├── batch.py
│   │   │   └── meeting.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── leads.py
│   │   │   ├── batches.py
│   │   │   ├── scrape.py
│   │   │   └── meetings.py
│   │   └── services/
│   │       └── auth.py
│   ├── requirements.txt
│   └── .env
│
├── .gitignore
└── README.md
```

---

## 7. Environment Variables (Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase) |
| `SECRET_KEY` | ✅ | JWT secret |
| `OPENAI_API_KEY` | No | For future AI scoring |
| `ZOOM_ACCOUNT_ID` | No | Zoom S2S OAuth (demo scheduling) |
| `ZOOM_CLIENT_ID` | No | Zoom S2S OAuth |
| `ZOOM_CLIENT_SECRET` | No | Zoom S2S OAuth |
| SMTP vars | No | For Zoom invite + reminder emails |

---

## 8. Routes

### Frontend

| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Landing |
| `/login` | No | Sign in |
| `/register` | No | Sign up |
| `/leads` | ✅ | Leads list + search + new search |
| `/leads/:id` | ✅ | Lead detail, stage, notes, call outcome, schedule demo, generate contract |
| `/add` | ✅ | Add lead manually |
| `/batches` | ✅ | Scrape batches + filters |
| `/pipeline` | ✅ | CRM board (stages) |
| `/analytics` | ✅ | Analytics dashboard |
| `/meetings` | ✅ | Upcoming Zoom demos |
| `/profile` | ✅ | Profile, password, delete account |

### API (main)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | No | Health |
| `/auth/register` | POST | No | Register |
| `/auth/login` | POST | No | Login (cookie + body token) |
| `/auth/logout` | POST | No | Logout |
| `/auth/me` | GET | Yes | Current user |
| `/leads` | GET/POST | Yes | List / create leads |
| `/leads/:id` | GET/PATCH | Yes | Get / update lead (stage, notes, call_outcome) |
| `/leads/:id/contract` | GET | Yes | HTML contract (auto-filled) |
| `/batches` | GET/POST | Yes | List / create batches |
| `/batches/:id/leads` | GET | Yes | Leads for batch |
| `/scrape/start` | POST | Yes | Start scrape job |
| `/scrape/status/:job_id` | GET | Yes | Job status |
| `/scrape/stop/:job_id` | POST | Yes | Stop job |
| `/meetings` | POST | Yes | Create Zoom meeting |
| `/meetings/upcoming` | GET | Yes | Upcoming meetings |
| `/meetings/lead/:id` | GET | Yes | Upcoming for lead |

---

## 9. Common Issues

**Port 8000 in use:** `lsof -i :8000` then `kill -9 <PID>`.

**Frontend can’t reach backend:** Ensure backend is running on http://127.0.0.1:8000.

**Contract 401:** Log in again so the app can store the auth token; use “Generate Contract” again.

**pip brackets:** Use quotes, e.g. `pip install "pydantic[email]"`.

**bcrypt:** `pip install "bcrypt==4.0.1"` if passlib complains.

---

## 10. Saving Requirements

```bash
cd backend && source venv/bin/activate && pip freeze > requirements.txt
```
