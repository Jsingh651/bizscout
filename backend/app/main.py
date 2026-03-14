from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models.lead import Lead, Base
from app.models.user import User
from app.models.batch import Batch          # ← import so table is created
from app.routers import leads
from app.routers import auth as auth_router
from app.routers import scrape as scrape_router
from app.routers import batches as batches_router   # ← new router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(leads.router)
app.include_router(auth_router.router)
app.include_router(scrape_router.router)
app.include_router(batches_router.router)   # ← register

@app.get("/")
def root():
    return {"message": "BizScout API is running"}