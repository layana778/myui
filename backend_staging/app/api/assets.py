"""
Asset CRUD API endpoints
"""
import json
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Asset, AssetLog, AssetStatus, OperationAction
from app.schemas.schemas import AssetOut, AssetLogCreate, AssetLogOut

router = APIRouter(prefix="/api", tags=["assets"])


def _asset_to_out(asset: Asset, db: Session) -> dict:
    """Convert ORM Asset to response dict with children_sns list"""
    children = db.query(Asset.sn).filter(Asset.parent_id == asset.sn).all()
    children_sns = [c.sn for c in children]
    # Also include text-based children (hardware specs stored as childrenSns in frontend)
    return {
        "sn": asset.sn,
        "state": asset.state.value,
        "latest_voucher_no": asset.latest_voucher_no or "",
        "parent_id": asset.parent_id,
        "children_sns": children_sns,
        "brand": asset.brand or "",
        "model": asset.model or "",
        "category": asset.category or "",
        "location": asset.location or "",
        "motherboard": asset.motherboard or "",
        "cpu": asset.cpu or "",
        "ram": asset.ram or "",
        "storage": asset.storage or "",
        "gpu": asset.gpu or "",
        "notes": asset.notes or "",
        "version_updated_at": asset.version_updated_at or 0,
    }


# ───── Assets ─────

@router.get("/assets", response_model=list[AssetOut])
def get_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    return [_asset_to_out(a, db) for a in assets]


@router.get("/assets/{sn}", response_model=AssetOut)
def get_asset(sn: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.sn == sn).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    return _asset_to_out(asset, db)


# ───── AssetLogs ─────

@router.get("/logs", response_model=list[AssetLogOut])
def get_logs(db: Session = Depends(get_db)):
    logs = db.query(AssetLog).order_by(AssetLog.timestamp.desc()).all()
    return logs


@router.get("/logs/pending", response_model=list[AssetLogOut])
def get_pending_logs(db: Session = Depends(get_db)):
    logs = db.query(AssetLog).filter(AssetLog.is_approved == False).order_by(AssetLog.timestamp.desc()).all()
    return logs


@router.post("/logs", response_model=AssetLogOut)
def submit_log(req: AssetLogCreate, db: Session = Depends(get_db)):
    """Warehouse submits a new asset movement log (pending approval)"""
    log_id = f"LOG-{uuid.uuid4().hex[:8].upper()}"
    now_ts = int(time.time() * 1000)

    ctx = json.loads(req.remark_context) if req.remark_context else {}

    # For INBOUND_NEW, auto-generate SN
    asset_sn = req.asset_sn
    if req.action == "INBOUND_NEW" and (not asset_sn or asset_sn.startswith("【")):
        asset_sn = f"AST-{uuid.uuid4().hex[:8].upper()}"

    log = AssetLog(
        log_id=log_id,
        asset_sn=asset_sn,
        action=req.action,
        status_before=req.status_before,
        status_after=req.status_after,
        voucher_no=req.voucher_no,
        submitter_id=req.submitter_id,
        submitter_name=req.submitter_name,
        timestamp=now_ts,
        is_approved=False,
        remark_context=req.remark_context or "{}",
    )

    # For new assets, create asset record immediately (in pending state)
    if req.action in ("INBOUND_NEW", "INBOUND_RECYCLE"):
        existing = db.query(Asset).filter(Asset.sn == asset_sn).first()
        if not existing:
            new_asset = Asset(
                sn=asset_sn,
                state=AssetStatus.IN_TRANSIT,  # pending until approved
                latest_voucher_no=req.voucher_no,
                brand=ctx.get("brand", ""),
                model=ctx.get("model", ""),
                category=ctx.get("category", "OTHER"),
                location=ctx.get("location", ""),
                motherboard=ctx.get("motherboard", ""),
                cpu=ctx.get("cpu", ""),
                ram=ctx.get("ram", ""),
                storage=ctx.get("storage", ""),
                gpu=ctx.get("gpu", ""),
                notes=ctx.get("notes", ""),
                version_updated_at=now_ts,
            )
            db.add(new_asset)

    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.post("/logs/{log_id}/approve", response_model=AssetLogOut)
def approve_log(log_id: str, db: Session = Depends(get_db)):
    """Ledger admin approves a pending log — updates asset state"""
    log = db.query(AssetLog).filter(AssetLog.log_id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="流水记录不存在")
    if log.is_approved:
        raise HTTPException(status_code=400, detail="该流水已审批")

    log.is_approved = True
    ctx = json.loads(log.remark_context) if log.remark_context else {}

    asset = db.query(Asset).filter(Asset.sn == log.asset_sn).first()
    if asset:
        asset.state = log.status_after
        asset.latest_voucher_no = log.voucher_no
        asset.version_updated_at = int(time.time() * 1000)
        if ctx.get("location"):
            asset.location = ctx["location"]

        # Handle MOUNT: set parent
        if log.action == OperationAction.MOUNT and ctx.get("mountTargetSn"):
            # The mounted component's parent becomes the target
            mount_name = ctx.get("mountName", "")
            mount_brand = ctx.get("mountBrand", "")
            mount_tag = f"🔧 {mount_name} ({mount_brand})"
            # We don't create sub-assets for text tags in this simplified version
            # Just note it in the target asset

        # Handle UNMOUNT
        if log.action == OperationAction.UNMOUNT and ctx.get("targetMountSn"):
            target = db.query(Asset).filter(Asset.sn == ctx["targetMountSn"]).first()
            if target:
                target.version_updated_at = int(time.time() * 1000)

    db.commit()
    db.refresh(log)
    return log


@router.post("/logs/{log_id}/reject")
def reject_log(log_id: str, db: Session = Depends(get_db)):
    """Ledger admin rejects a pending log"""
    log = db.query(AssetLog).filter(AssetLog.log_id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="流水记录不存在")
    db.delete(log)
    db.commit()
    return {"message": "已驳回并删除该流水"}
