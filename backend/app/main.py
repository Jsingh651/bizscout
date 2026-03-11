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
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(leads.router)
app.include_router(auth_router.router)

@app.get("/")
def root():
    return {"message": "BizScout API is running"}