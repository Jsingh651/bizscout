from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.database import engine
from app.models import Base, Lead, User, Batch, Meeting
from app.models.contract import Contract
from app.routers import leads
from app.routers import auth as auth_router
from app.routers import scrape as scrape_router
from app.routers import batches as batches_router
from app.routers import meetings as meetings_router
from app.routers import contracts as contracts_router
from app.routers import payments as payments_router
from app.models import payment
Base.metadata.create_all(bind=engine)

app = FastAPI()

ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(leads.router)
app.include_router(auth_router.router)
app.include_router(scrape_router.router)
app.include_router(batches_router.router)
app.include_router(meetings_router.router)
app.include_router(contracts_router.router)
app.include_router(payments_router.router)

@app.on_event("startup")
def _startup() -> None:
    try:
        meetings_router.start_reminder_worker()
    except Exception:
        pass


@app.get("/")
def root():
    return {"message": "BizScout API is running"}