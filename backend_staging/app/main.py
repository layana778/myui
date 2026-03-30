"""
Asset Risk Control System — FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api import auth, assets, anomalies

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="资产风控系统 API",
    description="Asset Risk Control System Backend",
    version="1.0.0",
)

# CORS: allow frontend dev server + LAN access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(anomalies.router)


@app.get("/")
def root():
    return {"message": "资产风控系统 API v1.0 运行中", "status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
