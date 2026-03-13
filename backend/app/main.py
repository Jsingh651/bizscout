from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models.lead import Lead, Base
from app.models.user import User
from app.routers import leads
from app.routers import auth as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Allow localhost on any port (useful when the dev server picks a different port)
    # We use allow_origin_regex so requests from e.g. http://localhost:5174 will be accepted.
    allow_origins=[],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(leads.router)
app.include_router(auth_router.router)

@app.get("/")
def root():
    return {"message": "BizScout API is running"}