"""
SQLAlchemy ORM Models — maps directly to our frontend TypeScript types
"""
import enum
from sqlalchemy import Column, String, Enum, ForeignKey, BigInteger, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


# ───────── Enums ─────────

class AssetStatus(str, enum.Enum):
    IN_TRANSIT = "IN_TRANSIT"
    IN_STOCK = "IN_STOCK"
    IN_USE = "IN_USE"
    ANOMALY_PENDING = "ANOMALY_PENDING"
    SCRAPPED = "SCRAPPED"


class OperationAction(str, enum.Enum):
    INITIAL_ENTRY = "INITIAL_ENTRY"
    INBOUND_NEW = "INBOUND_NEW"
    INBOUND_RECYCLE = "INBOUND_RECYCLE"
    OUTBOUND = "OUTBOUND"
    TRANSFER = "TRANSFER"
    SCRAP = "SCRAP"
    MOUNT = "MOUNT"
    UNMOUNT = "UNMOUNT"


class AnomalyLevel(str, enum.Enum):
    RED = "RED"
    YELLOW = "YELLOW"


class AnomalyType(str, enum.Enum):
    DUPLICATE_SN = "DUPLICATE_SN"
    ORPHAN_MOVEMENT = "ORPHAN_MOVEMENT"
    NEGATIVE_INVENTORY = "NEGATIVE_INVENTORY"
    HIERARCHY_PARADOX = "HIERARCHY_PARADOX"


class AnomalyWarehouseStatus(str, enum.Enum):
    PENDING = "PENDING"
    REJECTED_TO_WH = "REJECTED_TO_WH"
    SUBMITTED_BY_WH = "SUBMITTED_BY_WH"


class Role(str, enum.Enum):
    WAREHOUSE = "WAREHOUSE"
    LEDGER = "LEDGER"


# ───────── Models ─────────

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    role = Column(Enum(Role), nullable=False)
    password_hash = Column(String(200), nullable=False)


class Asset(Base):
    __tablename__ = "assets"

    sn = Column(String(50), primary_key=True)
    state = Column(Enum(AssetStatus), nullable=False, default=AssetStatus.IN_STOCK)
    latest_voucher_no = Column(String(100), default="")
    parent_id = Column(String(50), ForeignKey("assets.sn"), nullable=True)
    brand = Column(String(100), default="")
    model = Column(String(200), default="")
    category = Column(String(50), default="OTHER")
    location = Column(String(200), default="")
    motherboard = Column(String(200), default="")
    cpu = Column(String(200), default="")
    ram = Column(String(200), default="")
    storage = Column(String(200), default="")
    gpu = Column(String(200), default="")
    notes = Column(Text, default="")
    version_updated_at = Column(BigInteger, default=0)

    # Self-referencing relationship for parent-children
    children = relationship("Asset", backref="parent", remote_side=[sn], foreign_keys=[parent_id])
    logs = relationship("AssetLog", back_populates="asset", cascade="all, delete-orphan")


class AssetLog(Base):
    __tablename__ = "asset_logs"

    log_id = Column(String(50), primary_key=True)
    asset_sn = Column(String(50), ForeignKey("assets.sn"), nullable=False)
    action = Column(Enum(OperationAction), nullable=False)
    status_before = Column(Enum(AssetStatus), nullable=True)
    status_after = Column(Enum(AssetStatus), nullable=False)
    voucher_no = Column(String(100), default="")
    submitter_id = Column(String(50), default="")
    submitter_name = Column(String(100), default="")
    timestamp = Column(BigInteger, nullable=False)
    is_approved = Column(Boolean, default=False)
    remark_context = Column(Text, default="{}")  # JSON string for flexible extra data
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="logs")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    record_id = Column(String(50), primary_key=True)
    asset_sn = Column(String(50), ForeignKey("assets.sn"), nullable=False)
    level = Column(Enum(AnomalyLevel), nullable=False)
    type = Column(Enum(AnomalyType), nullable=False)
    description = Column(Text, default="")
    conflict_payload = Column(Text, default="{}")  # JSON string
    is_resolved = Column(Boolean, default=False)
    warehouse_status = Column(Enum(AnomalyWarehouseStatus), default=AnomalyWarehouseStatus.PENDING)
    warehouse_reject_reason = Column(Text, default="")
    warehouse_supplement_voucher = Column(String(100), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
