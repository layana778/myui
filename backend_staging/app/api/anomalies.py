"""
Anomaly risk control API endpoints
"""
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AnomalyRecord, Asset, AssetStatus, AnomalyWarehouseStatus
from app.schemas.schemas import (
    AnomalyRecordOut, ResolveAnomalyRequest,
    ResolveDuplicateSnRequest, RejectAnomalyRequest, SupplementVoucherRequest,
)

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])


@router.get("/", response_model=list[AnomalyRecordOut])
def get_anomalies(db: Session = Depends(get_db)):
    records = db.query(AnomalyRecord).order_by(AnomalyRecord.created_at.desc()).all()
    return records


@router.get("/warehouse-tasks", response_model=list[AnomalyRecordOut])
def get_warehouse_tasks(db: Session = Depends(get_db)):
    """Get anomalies rejected to warehouse for correction"""
    records = db.query(AnomalyRecord).filter(
        AnomalyRecord.warehouse_status == AnomalyWarehouseStatus.REJECTED_TO_WH
    ).all()
    return records


@router.post("/{record_id}/resolve", response_model=AnomalyRecordOut)
def resolve_anomaly(record_id: str, req: ResolveAnomalyRequest, db: Session = Depends(get_db)):
    """Resolve anomaly by providing a voucher number (for orphan/ghost types)"""
    record = db.query(AnomalyRecord).filter(AnomalyRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    record.is_resolved = True
    record.warehouse_supplement_voucher = req.voucher_no
    record.resolved_at = time.strftime("%Y-%m-%d %H:%M:%S")

    # Update asset state back to normal
    asset = db.query(Asset).filter(Asset.sn == record.asset_sn).first()
    if asset and asset.state == AssetStatus.ANOMALY_PENDING:
        asset.state = AssetStatus.IN_USE
        asset.latest_voucher_no = req.voucher_no
        asset.version_updated_at = int(time.time() * 1000)

    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/resolve-duplicate", response_model=AnomalyRecordOut)
def resolve_duplicate_sn(record_id: str, req: ResolveDuplicateSnRequest, db: Session = Depends(get_db)):
    """Resolve duplicate SN by assigning a new SN to selected instance"""
    record = db.query(AnomalyRecord).filter(AnomalyRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    # Check new SN doesn't already exist
    existing = db.query(Asset).filter(Asset.sn == req.new_asset_sn).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"编号 {req.new_asset_sn} 已存在，请使用其他编号")

    record.is_resolved = True
    record.resolved_at = time.strftime("%Y-%m-%d %H:%M:%S")

    # Update asset state
    asset = db.query(Asset).filter(Asset.sn == record.asset_sn).first()
    if asset and asset.state == AssetStatus.ANOMALY_PENDING:
        asset.state = AssetStatus.IN_USE
        asset.version_updated_at = int(time.time() * 1000)

    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/reject", response_model=AnomalyRecordOut)
def reject_to_warehouse(record_id: str, req: RejectAnomalyRequest, db: Session = Depends(get_db)):
    """Reject anomaly back to warehouse operator for correction"""
    record = db.query(AnomalyRecord).filter(AnomalyRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    record.warehouse_status = AnomalyWarehouseStatus.REJECTED_TO_WH
    record.warehouse_reject_reason = req.reason

    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/supplement", response_model=AnomalyRecordOut)
def warehouse_supplement(record_id: str, req: SupplementVoucherRequest, db: Session = Depends(get_db)):
    """Warehouse operator supplements voucher for a rejected anomaly"""
    record = db.query(AnomalyRecord).filter(AnomalyRecord.record_id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    record.warehouse_status = AnomalyWarehouseStatus.SUBMITTED_BY_WH
    record.warehouse_supplement_voucher = req.voucher_no

    db.commit()
    db.refresh(record)
    return record
