"""
Database connection configuration
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql://asset_admin:AssetRisk2026@127.0.0.1:5432/asset_risk_db"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yield a DB session per request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
