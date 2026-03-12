# bizscout
# BizScout

AI-powered local business lead intelligence platform. Find businesses without websites, score them with AI, and manage your entire sales pipeline.

**Stack:** React + Vite · FastAPI · PostgreSQL (Supabase) · SQLAlchemy · JWT Auth

---

## Prerequisites

Make sure you have these installed before starting:

- **Node.js** v18+ → https://nodejs.org
- **Python** 3.9+ → https://www.python.org/downloads
- **Git** → https://git-scm.com
- A **Supabase** account (free) → https://supabase.com

---

## 1. Clone the Repo

```bash
git clone https://github.com/jsingh651s/bizscout.git
cd bizscout
```

---

## 2. Supabase Setup

1. Go to https://supabase.com and create a new project
2. Once created, go to **Settings → Database**
3. Copy your **Connection String** (URI format) — it looks like:
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Keep this handy — you'll need it in the next step

> The `leads` and `users` tables are created automatically when you first run the backend.

---

## 3. Backend Setup

### Navigate to backend folder
```bash
cd backend
```

### Create and activate virtual environment
```bash
# Create venv
python3 -m venv venv

# Activate (Mac/Linux)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate
```

> You should see `(venv)` at the start of your terminal line when activated.

### Install all dependencies
```bash
pip install fastapi
pip install uvicorn
pip install sqlalchemy
pip install psycopg2-binary
pip install python-dotenv
pip install "pydantic[email]"
pip install "python-jose[cryptography]"
pip install "passlib[bcrypt]"
pip install "bcrypt==4.0.1"
pip install python-multipart
pip install openai
pip install playwright
```

Or install everything in one command:
```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv "pydantic[email]" "python-jose[cryptography]" "passlib[bcrypt]" "bcrypt==4.0.1" python-multipart openai playwright
```

### Create the .env file
```bash
touch .env
```

Open `.env` and add the following — replace the values with your own:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
SECRET_KEY=your-long-random-secret-key-change-this-in-production
OPENAI_API_KEY=sk-your-openai-key-here
```

> `SECRET_KEY` can be anything long and random. In production use a proper secret generator.
> `OPENAI_API_KEY` is optional for now — only needed when AI scoring is implemented.

### Start the backend server
```bash
uvicorn app.main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Test it by opening http://127.0.0.1:8000 in your browser — you should see:
```json
{"message": "BizScout API is running"}
```

Interactive API docs are available at http://127.0.0.1:8000/docs

---

## 4. Frontend Setup

Open a **new terminal tab** and navigate to the frontend folder:

```bash
cd bizscout/frontend
```

### Install all dependencies
```bash
npm install
```

This installs everything in `package.json` including:

| Package | Purpose |
|---|---|
| `react` | UI framework |
| `react-dom` | React DOM renderer |
| `react-router-dom` | Client-side routing |
| `react-hook-form` | Form validation |
| `react-select` | Custom styled dropdowns |
| `lucide-react` | Icon library |
| `axios` | HTTP client |
| `vite` | Build tool / dev server |

### Start the frontend dev server
```bash
npm run dev
```

You should see:
```
VITE ready in Xms
➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser.

---

## 5. Running the Full App

You need **two terminals** running simultaneously:

**Terminal 1 — Backend:**
```bash
cd bizscout/backend
source venv/bin/activate    # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd bizscout/frontend
npm run dev
```

Then visit http://localhost:5173

---

## 6. Folder Structure

```
bizscout/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Auth state (login/logout/me)
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Landing page
│   │   │   ├── Login.jsx            # Login page
│   │   │   ├── Register.jsx         # Register page
│   │   │   ├── Leads.jsx            # Leads dashboard
│   │   │   └── AddLead.jsx          # Add lead form
│   │   ├── App.jsx                  # Router + protected routes
│   │   └── main.jsx                 # App entry point
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + CORS + router setup
│   │   ├── database.py              # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── lead.py              # Lead table model
│   │   │   └── user.py              # User table model
│   │   ├── routers/
│   │   │   ├── leads.py             # GET /leads, POST /leads
│   │   │   └── auth.py              # POST /auth/register, /auth/login, /auth/logout, GET /auth/me
│   │   └── services/
│   │       └── auth.py              # JWT tokens, bcrypt hashing, user queries
│   ├── venv/                        # Python virtual environment (gitignored)
│   ├── requirements.txt
│   └── .env                         # Secrets (gitignored)
│
├── .gitignore
└── README.md
```

---

## 7. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `SECRET_KEY` | ✅ | JWT signing secret — keep this private |
| `OPENAI_API_KEY` | Optional | OpenAI key for AI lead scoring (future feature) |

---

## 8. Common Issues

**`Address already in use` on port 8000:**
```bash
lsof -i :8000
kill -9 <PID>
uvicorn app.main:app --reload
```

**`zsh: no matches found` when installing packages:**

Wrap brackets in quotes:
```bash
pip install "pydantic[email]"
pip install "python-jose[cryptography]"
pip install "passlib[bcrypt]"
```

**`bcrypt` version error with passlib:**
```bash
pip install "bcrypt==4.0.1"
```

**Frontend can't connect to backend (ERR_CONNECTION_REFUSED):**

Make sure the backend is running on port 8000. All fetch calls in the frontend point to `http://127.0.0.1:8000`.

**`ModuleNotFoundError` on backend startup:**

Make sure your venv is activated — you should see `(venv)` in your terminal. Then reinstall deps:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

---

## 9. Saving Requirements

After installing backend packages, freeze them to `requirements.txt`:
```bash
cd backend
source venv/bin/activate
pip freeze > requirements.txt
```

Next time you clone the repo, you can install everything at once:
```bash
pip install -r requirements.txt
```

---

## Routes

| Route | Auth Required | Description |
|---|---|---|
| `/` | No | Landing page |
| `/login` | No | Sign in |
| `/register` | No | Create account |
| `/leads` | ✅ Yes | Leads dashboard |
| `/add` | ✅ Yes | Add a new lead |

| API Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | No | Health check |
| `/auth/register` | POST | No | Create account |
| `/auth/login` | POST | No | Sign in, sets cookie |
| `/auth/logout` | POST | No | Clear cookie |
| `/auth/me` | GET | Cookie | Get current user |
| `/leads` | GET | No | Get all leads |
| `/leads` | POST | No | Create a lead |