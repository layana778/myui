"""
Authentication API endpoints
"""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if hashlib.sha256(req.password.encode()).hexdigest() != user.password_hash:
        raise HTTPException(status_code=401, detail="密码错误")
    # Simple token (production should use JWT)
    token = f"token-{user.id}-{user.role.value}"
    return LoginResponse(token=token, user=UserOut.model_validate(user))
