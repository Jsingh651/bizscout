# BizScout

AI-powered local business lead intelligence platform for website sales automation. Find businesses without websites, score and prioritize leads, manage your pipeline, schedule demos, and generate contracts.

**Stack:** React + Vite · FastAPI · PostgreSQL (Supabase) · SQLAlchemy · JWT Auth
---

## What the Website Does (Current)

- **Auth (JWT)** — Register, login, logout, `me`, update profile (name + password). Tokens are accepted via the `Authorization: Bearer` header **or** an httpOnly cookie, so auth works on same-origin and cross-site (Vercel ↔ Railway) deployments alike. Frontend protects routes via `AuthContext`.
- **Multi-tenant by design** — Every account works the **same shared lead pool** but keeps its **own private pipeline** (stage, notes, call outcome) per lead. See [Multi-tenant data model](#multi-tenant-data-model).
- **Lead scraper (Google Maps)** — Start a background scrape by **niche + city** with optional **“no website only”** filter. Live status shows progress, ETA, and streaming “found companies”. Stopping early still saves leads to the DB.
- **Lead scoring (0–100)** — Rule-based score combining 7 signals: website status, rating, review count, business age, category urgency, phone present, address present. Lead Detail shows a visual score breakdown.
- **Batches** — Each scrape run is grouped into a batch (query + location) with lead count, average score, and “no website” count.
- **Leads page** — Run scrapes, see previous batches, and view a summary of total leads and “no website” opportunities.
- **Lead Detail** — Full lead profile (name, city, phone, address, website, rating, reviews, age), pipeline stage, call outcome history, notes editor, score explanation, and per-lead contracts section.
- **Pipeline (CRM board)** — Kanban-style stages: New Lead, Contacted, Interested, Proposal Sent, Closed Won, Closed Lost.
- **Demo scheduling (Zoom)** — From Lead Detail, schedule a Zoom demo; backend creates a Zoom meeting and (if SMTP is configured) sends a professional HTML invite email with the join link.
- **Meeting reminder (current)** — Background worker sends a **single “starts soon” reminder ~10 minutes before** the meeting (only for meetings at least ~2 hours out).
- **Meetings page** — Lists upcoming demos with join links, mapped to leads.
- **Contract generator** — From Lead Detail or the Contracts area, generate a web design agreement HTML, auto-filled with lead + profile data; client can sign via a public link, and signed copies can be turned into PDFs via headless Chrome.
- **Contracts dashboard** — View all contracts, filter by status (Draft / Pending / Signed), download PDFs, and jump back to the underlying lead.
- **Stripe-powered billing & invoices** — From a signed contract, send initial and final invoices via email, generate Stripe Checkout sessions for deposits/final payments/full plan, and track payment status per lead/contract.
- **Payment links & portal** — Public payment pages let clients pay invoices securely via Stripe (full/split plans), with automatic status updates via webhooks and a payments list inside the app.
- **Analytics** — Combined dashboard for leads, batches, and contracts (total leads, “no website” share, score distribution, pipeline funnel, and contract revenue stats).

---

## Multi-tenant data model

BizScout is multi-tenant over a **single shared lead pool**. The scraped `leads`
table is global — every account sees the same businesses — but each account's
CRM activity is private.

- **Private pipeline** — A user's stage, notes and call outcome for a lead live
  in `lead_pipeline`, keyed on `(user_id, lead_id)`. One rep marking a lead
  "Not Interested" leaves it untouched and "New Lead" for everyone else.
- **Global rejection** — When **more than 5 distinct users** mark the same lead
  "Not Interested", the business is a confirmed dead end. It is retired from the
  shared pool for everyone and a snapshot is written to `rejected_leads`.
- **Global success** — When a user reaches **"Closed Won"** (the business bought
  a site), the lead is retired for everyone and credited to that user in
  `successful_leads`. A sold business no longer needs outreach.
- Retired leads are soft-archived (`leads.is_archived`) so signed contracts and
  invoices that reference them stay valid; they disappear from every list and
  detail view.
- **Contracts, invoices/Stripe, and meetings** carry a `user_id` and are scoped
  to the account that created them.

### Row-level security

The per-user tables (`lead_pipeline`, `contracts`, `payments`, `meetings`) have
Postgres **row-level-security** policies that restrict rows to the authenticated
user via an `app.current_user_id` session variable set on every request
(`get_current_user`). Application-layer `WHERE user_id = :me` filters are the
primary, test-covered guarantee; RLS is defense-in-depth for any direct database
access. RLS is enabled automatically on Postgres and skipped on SQLite (used for
local dev/tests).

## Feature List (Done vs Planned)

| # | Feature | Status |
|---|---------|--------|
| 1 | **Lead Scraper** — Scrapes Google Maps for local businesses without websites; stores leads in DB | ✅ Done |
| 2 | **Lead Scoring** — Scores leads (reviews, category, etc.); High / Medium / Low priority | ✅ Done (rule-based 0–100) |
| 3 | **Automatic Call Queue (Power Dialer)** — One-click “Start Calling”; sequential calls; auto-advance on no answer; stop on answer | ⬜ Not done |
| 4 | **Call Outcome Buttons** — After each call: Interested, Not Interested, Call Later, No Answer, Wrong Number; each can trigger automations | ✅ Done (buttons + storage; no automations yet) |
| 5 | **Automated Follow-Up** — Day 1, Day 3, Day 7 follow-up emails when lead doesn’t respond | ⬜ Not done |
| 6 | **Demo Scheduling** — Enter email in dashboard; system creates Zoom meeting and emails link to prospect | ✅ Done |
| 7 | **Meeting Reminder Automation** — 24h, 1h, 10min reminders for scheduled demos | ⬜ Not done (currently only ~10‑min “starts soon” reminder) |
| 8 | **One-Click Demo Website Generator** — Generate sample homepage from business name, photos, services, reviews | ⬜ Not done |
| 9 | **Contract Generator** — Generate contract from lead; auto-fill name, company, address, email, phone; set build price, monthly price, scope, timeline | ✅ Done (basic: auto-fill from lead; no UI for price/scope/timeline) |
| 10 | **Electronic Signature** — Secure signing link; client signs; signed PDF stored in CRM | ⬜ Not done |
| 11 | **Automatic Invoice** — After contract signed, auto-send invoice + payment link | ✅ Done (Stripe invoice links + payment page, basic flow) |
| 12 | **Sales Pipeline / CRM Board** — Stages: New Leads → Called → Interested → Demo Scheduled → Contract Sent → Closed | ✅ Done |
| 13 | **Analytics Dashboard** — Leads scraped, calls made, meetings booked, contracts sent, deals closed, revenue | ✅ Done (leads/batches/breakdowns; calls/contracts/revenue not yet) |
| 14 | **Domain Availability Checker** — Quick domain check during sales calls | ⬜ Not done |
| 15 | **Client Portal** — After purchase: login to view project progress, invoices, support, hosting status | ⬜ Not done |
| 16 | **Website Delivery Automation** — After payment: auto-create project, task checklist (e.g. collect logo, photos, theme, launch) | ⬜ Not done |

---

## Prerequisites

- **Node.js** v18+: `https://nodejs.org`
- **Python** 3.9+: `https://www.python.org/downloads`
- **Git**: `https://git-scm.com`
- **Supabase** account (free): `https://supabase.com`

---

## 1. Clone the Repo

```bash
git clone https://github.com/jsingh651s/bizscout.git
cd bizscout
```

---

## 2. Supabase Setup

1. Create a project at `https://supabase.com`
2. **Settings → Database** → copy **Connection String** (URI):
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
3. The `leads`, `users`, `batches`, `meetings`, and `contracts` tables are created automatically on first backend run (via SQLAlchemy `create_all`).

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

Optional for Zoom + email: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, optional `ZOOM_USER_ID`, and SMTP vars (see `backend/app/routers/meetings.py`).

Start backend:

```bash
uvicorn app.main:app --reload
```

API: `http://127.0.0.1:8000` · Docs: `http://127.0.0.1:8000/docs`

---

## 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

Frontend env:

```bash
cd frontend
cp .env.example .env.local
```

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
├── README.md
├── package.json
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── venv/
│   └── app/
│       ├── main.py
│       ├── database.py
│       ├── dependencies.py
│       ├── maps_scraper.py
│       ├── batch_runner.py
│       ├── logs/
│       ├── checkpoints/
│       ├── models/
│       │   ├── __init__.py
│       │   ├── lead.py
│       │   ├── user.py
│       │   ├── batch.py
│       │   ├── meeting.py
│       │   └── contract.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── leads.py
│       │   ├── batches.py
│       │   ├── meetings.py
│       │   ├── scrape.py
│       │   ├── contracts.py
│       │   └── payments.py
│       └── services/
│           └── auth.py
│
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── NavbarDropdown.jsx
│   │   │   └── LeadContracts.jsx
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
│   │   │   ├── Profile.jsx
│   │   │   ├── ContractPage.jsx
│   │   │   ├── ContractsPage.jsx
│   │   │   └── SignContractPage.jsx
│   │   ├── styles/
│   │   │   └── datepicker-overrides.css
│   │   └── utils/
│   │       ├── contractTemplate.js
│   │       └── pdfUtils.js
│   └── node_modules/
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
| `/leads` | GET/POST | Partial | List / create leads (currently not authenticated) |
| `/leads/{lead_id}` | GET/PATCH | Partial | Get / update lead (stage, notes, call_outcome) (currently not authenticated) |
| `/leads/{lead_id}/contract` | GET | Yes | HTML contract (auto-filled; requires cookie or Bearer token) |
| `/batches` | GET | Partial | List batches (currently not authenticated) |
| `/batches/{batch_id}/leads` | GET | Partial | Leads for batch (currently not authenticated) |
| `/scrape/start` | POST | Partial | Start scrape job (currently not authenticated) |
| `/scrape/status/{job_id}` | GET | Partial | Job status (currently not authenticated) |
| `/scrape/stop/{job_id}` | POST | Partial | Stop job (currently not authenticated) |
| `/meetings` | POST | Partial | Create Zoom meeting (currently not authenticated) |
| `/meetings/upcoming` | GET | Partial | Upcoming meetings (currently not authenticated) |
| `/meetings/lead/{lead_id}` | GET | Partial | Next upcoming for lead (currently not authenticated) |
| `/contracts/create` | POST | Yes | Create a contract draft for a given lead |
| `/contracts/by-lead/{lead_id}` | GET | Yes | Contracts for a specific lead |
| `/contracts/all` | GET | Yes | All contracts for the current user |
| `/contracts/download/{contract_id}` | GET | Yes | Download regenerated signed PDF |
| `/contracts/public/{token}` | GET | No | Public client view/sign endpoint |
| `/contracts/sign/designer` | POST | Yes | Designer e-sign |
| `/contracts/sign/client` | POST | No | Client e-sign via token |
| `/contracts/send-to-client` | POST | Yes | Email client signing link |
| `/contracts/save-pdf/{contract_id}` | POST | No | Save final signed PDF + notify both parties |

---

## 9. Common Issues

**Port 8000 in use:** `lsof -i :8000` then `kill -9 <PID>`.

**Frontend can’t reach backend:** Ensure backend is running on http://127.0.0.1:8000 (or that `VITE_API_URL` points at your Railway URL).

**Contract 401:** Log in again so the app can store the auth token; use “Generate Contract” again.

**pip brackets:** Use quotes, e.g. `pip install "pydantic[email]"`.

**bcrypt:** `pip install "bcrypt==4.0.1"` if passlib complains.

---

## 10. Saving Requirements

```bash
cd backend && source venv/bin/activate && pip freeze > requirements.txt
```

---

## 11. Deployment

### Frontend → Vercel
1. Push repo to GitHub.
2. On Vercel, create a **New Project** from this repo and set the root directory to `frontend`.
3. Add environment variable: `VITE_API_URL` = your Railway backend URL.
4. Deploy.

### Backend → Railway
1. On Railway, create a **New Project** from the same GitHub repo.
2. Set the root directory to `backend`.
3. Add all environment variables from `backend/.env.example`.
4. Railway will detect the `Procfile` and deploy the FastAPI app.

### After deploying both:
1. Update `FRONTEND_URL` in Railway env vars to your Vercel URL.
2. Update `VITE_API_URL` in Vercel env vars to your Railway URL.
3. Update `ALLOWED_ORIGIN_REGEX` in Railway to include your Vercel domain.
4. Update the Stripe webhook endpoint in the Stripe Dashboard to your Railway URL + `/payments/webhook`.
5. Redeploy both services.

---

## 12. What’s Left To Do (Next Priorities)

- **Frontend**
  - Replace remaining hardcoded API URLs (`http://127.0.0.1:8000`) with `VITE_API_URL`.
  - Add better empty/loading/error states on all pages.

- **Backend**
  - Enforce auth consistently on leads/batches/scrape/meetings routes and scope data per user.
  - Add DB migrations (Alembic) instead of relying on `create_all`.

- **Meetings**
  - Implement proper multi-step reminders (24h, 1h, 10m) with robust scheduling.

- **Sales Automation**
  - Add power dialer/call queue behavior and automated follow-ups.

- **Contracts & Billing**
  - Finish e-sign → invoice → payment automation and connect to Stripe.
