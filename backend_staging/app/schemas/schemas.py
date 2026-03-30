"""
Pydantic schemas for API request/response serialization
"""
from pydantic import BaseModel
from typing import Optional
from enum import Enum


# ───── Enums (mirror the ORM enums for API layer) ─────

class AssetStatusEnum(str, Enum):
    IN_TRANSIT = "IN_TRANSIT"
    IN_STOCK = "IN_STOCK"
    IN_USE = "IN_USE"
    ANOMALY_PENDING = "ANOMALY_PENDING"
    SCRAPPED = "SCRAPPED"

class OperationActionEnum(str, Enum):
    INITIAL_ENTRY = "INITIAL_ENTRY"
    INBOUND_NEW = "INBOUND_NEW"
    INBOUND_RECYCLE = "INBOUND_RECYCLE"
    OUTBOUND = "OUTBOUND"
    TRANSFER = "TRANSFER"
    SCRAP = "SCRAP"
    MOUNT = "MOUNT"
    UNMOUNT = "UNMOUNT"

class AnomalyLevelEnum(str, Enum):
    RED = "RED"
    YELLOW = "YELLOW"

class AnomalyTypeEnum(str, Enum):
    DUPLICATE_SN = "DUPLICATE_SN"
    ORPHAN_MOVEMENT = "ORPHAN_MOVEMENT"
    NEGATIVE_INVENTORY = "NEGATIVE_INVENTORY"
    HIERARCHY_PARADOX = "HIERARCHY_PARADOX"

class AnomalyWarehouseStatusEnum(str, Enum):
    PENDING = "PENDING"
    REJECTED_TO_WH = "REJECTED_TO_WH"
    SUBMITTED_BY_WH = "SUBMITTED_BY_WH"

class RoleEnum(str, Enum):
    WAREHOUSE = "WAREHOUSE"
    LEDGER = "LEDGER"


# ───── Auth ─────

class LoginRequest(BaseModel):
    user_id: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: "UserOut"

class UserOut(BaseModel):
    id: str
    name: str
    role: RoleEnum

    class Config:
        from_attributes = True


# ───── Asset ─────

class AssetOut(BaseModel):
    sn: str
    state: AssetStatusEnum
    latest_voucher_no: str = ""
    parent_id: Optional[str] = None
    children_sns: list[str] = []
    brand: str = ""
    model: str = ""
    category: str = ""
    location: str = ""
    motherboard: str = ""
    cpu: str = ""
    ram: str = ""
    storage: str = ""
    gpu: str = ""
    notes: str = ""
    version_updated_at: int = 0

    class Config:
        from_attributes = True


# ───── AssetLog ─────

class AssetLogCreate(BaseModel):
    asset_sn: str
    action: OperationActionEnum
    status_before: Optional[AssetStatusEnum] = None
    status_after: AssetStatusEnum
    voucher_no: str
    submitter_id: str
    submitter_name: str
    remark_context: str = "{}"

class AssetLogOut(BaseModel):
    log_id: str
    asset_sn: str
    action: OperationActionEnum
    status_before: Optional[AssetStatusEnum] = None
    status_after: AssetStatusEnum
    voucher_no: str
    submitter_id: str
    submitter_name: str
    timestamp: int
    is_approved: bool
    remark_context: str = "{}"

    class Config:
        from_attributes = True


# ───── AnomalyRecord ─────

class AnomalyRecordOut(BaseModel):
    record_id: str
    asset_sn: str
    level: AnomalyLevelEnum
    type: AnomalyTypeEnum
    description: str = ""
    conflict_payload: str = "{}"
    is_resolved: bool = False
    warehouse_status: AnomalyWarehouseStatusEnum = AnomalyWarehouseStatusEnum.PENDING
    warehouse_reject_reason: str = ""
    warehouse_supplement_voucher: str = ""

    class Config:
        from_attributes = True

class ResolveAnomalyRequest(BaseModel):
    voucher_no: str

class ResolveDuplicateSnRequest(BaseModel):
    new_asset_sn: str
    selected_instance: str = ""

class RejectAnomalyRequest(BaseModel):
    reason: str

class SupplementVoucherRequest(BaseModel):
    voucher_no: str
