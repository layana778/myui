"""
Seed script: populate database with initial mock data (users, assets, logs, anomalies)
Run once: cd /home/paulzhang/asset_backend && source venv/bin/activate && python seed.py
"""
import json
import time
import hashlib
from app.core.database import SessionLocal, engine, Base
from app.models.models import (
    User, Asset, AssetLog, AnomalyRecord,
    Role, AssetStatus, OperationAction, AnomalyLevel, AnomalyType, AnomalyWarehouseStatus,
)

# Recreate all tables
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

now = int(time.time() * 1000)
day = 24 * 60 * 60 * 1000

# ───── Users ─────
users = [
    User(id="WH-001", name="李库管", role=Role.WAREHOUSE, password_hash=hashlib.sha256("123456".encode()).hexdigest()),
    User(id="WH-002", name="王仓储", role=Role.WAREHOUSE, password_hash=hashlib.sha256("123456".encode()).hexdigest()),
    User(id="LG-001", name="张台账", role=Role.LEDGER, password_hash=hashlib.sha256("123456".encode()).hexdigest()),
    User(id="LG-002", name="赵审计", role=Role.LEDGER, password_hash=hashlib.sha256("123456".encode()).hexdigest()),
]
db.add_all(users)
db.commit()

# ───── Assets ─────
assets = [
    Asset(sn="SVR-BJ-001", state=AssetStatus.IN_USE, latest_voucher_no="OA-TRANS-20260301",
          parent_id=None, brand="Dell", model="PowerEdge R740", category="SERVER",
          location="北京A栋-1F-机架01", motherboard="Dell C621", cpu="Xeon Gold 6248R x2",
          ram="DDR4 ECC 256GB", storage="SAS 2.4TB x8", gpu="", version_updated_at=now - 2*day),

    Asset(sn="GPU-3090-A01", state=AssetStatus.IN_USE, latest_voucher_no="OA-MNT-20260305",
          parent_id="SVR-BJ-001", brand="NVIDIA", model="RTX 3090", category="GPU",
          location="北京A栋-1F-机架01", version_updated_at=now - 5*day),

    Asset(sn="MEM-64G-B02", state=AssetStatus.IN_USE, latest_voucher_no="OA-MNT-20260305",
          parent_id="SVR-BJ-001", brand="Samsung", model="DDR5 64GB", category="MEMORY",
          location="北京A栋-1F-机架01", version_updated_at=now - 5*day),

    Asset(sn="GPU-A100-X03", state=AssetStatus.IN_STOCK, latest_voucher_no="OA-RCV-20260210",
          parent_id=None, brand="NVIDIA", model="A100 80GB", category="GPU",
          location="库房-IT备件区", version_updated_at=now - 40*day),

    Asset(sn="SVR-SH-002", state=AssetStatus.ANOMALY_PENDING, latest_voucher_no="OA-TRANS-20260201",
          parent_id=None, brand="HPE", model="ProLiant DL380", category="SERVER",
          location="上海B栋-2F-机架12", version_updated_at=now - 45*day),

    Asset(sn="SSD-2T-C01", state=AssetStatus.ANOMALY_PENDING, latest_voucher_no="",
          parent_id="SVR-SH-002", brand="Samsung", model="PM9A3 2TB", category="SSD",
          location="上海B栋-2F-机架12", version_updated_at=now - 45*day),

    Asset(sn="SVR-BJ-003", state=AssetStatus.IN_TRANSIT, latest_voucher_no="OA-TRANS-20260320",
          parent_id=None, brand="Lenovo", model="ThinkSystem SR650", category="SERVER",
          location="物流在途", version_updated_at=now - 3*day),

    Asset(sn="GPU-4090-D04", state=AssetStatus.SCRAPPED, latest_voucher_no="OA-SCRAP-20260101",
          parent_id=None, brand="NVIDIA", model="RTX 4090", category="GPU",
          location="报废库", version_updated_at=now - 80*day),
]
db.add_all(assets)
db.commit()

# ───── AssetLogs ─────
logs = [
    AssetLog(log_id="LOG-001", asset_sn="SVR-BJ-001", action=OperationAction.INITIAL_ENTRY,
             status_before=None, status_after=AssetStatus.IN_STOCK,
             voucher_no="OA-INIT-20260101", submitter_id="WH-001", submitter_name="李库管",
             timestamp=now - 90*day, is_approved=True),
    AssetLog(log_id="LOG-002", asset_sn="SVR-BJ-001", action=OperationAction.TRANSFER,
             status_before=AssetStatus.IN_STOCK, status_after=AssetStatus.IN_USE,
             voucher_no="OA-TRANS-20260301", submitter_id="WH-001", submitter_name="李库管",
             timestamp=now - 2*day, is_approved=True),
    AssetLog(log_id="LOG-003", asset_sn="SVR-SH-002", action=OperationAction.TRANSFER,
             status_before=AssetStatus.IN_STOCK, status_after=AssetStatus.IN_USE,
             voucher_no="OA-TRANS-20260201", submitter_id="WH-001", submitter_name="李库管",
             timestamp=now - 45*day, is_approved=True),
    AssetLog(log_id="LOG-004", asset_sn="SVR-BJ-003", action=OperationAction.INBOUND_NEW,
             status_before=None, status_after=AssetStatus.IN_TRANSIT,
             voucher_no="OA-TRANS-20260320", submitter_id="WH-002", submitter_name="王仓储",
             timestamp=now - 3*day, is_approved=False),
]
db.add_all(logs)
db.commit()

# ───── Anomaly Records ─────
anomalies_data = [
    AnomalyRecord(
        record_id="ANO-001", asset_sn="SVR-SH-002",
        level=AnomalyLevel.RED, type=AnomalyType.DUPLICATE_SN,
        description="条形码 SVR-SH-002 同时出现在上海B栋-2F-机架12 和 北京A栋-3F-机架05",
        conflict_payload=json.dumps({
            "currentHolder": "上海B栋-2F-机架12",
            "externalIncomingData": {"found_in": ["上海B栋-2F-机架12", "北京A栋-3F-机架05"]},
        }),
    ),
    AnomalyRecord(
        record_id="ANO-002", asset_sn="SSD-2T-C01",
        level=AnomalyLevel.RED, type=AnomalyType.ORPHAN_MOVEMENT,
        description="SSD-2T-C01 发生了实物异動但系统中找不到对应的OA凭证单号",
        conflict_payload=json.dumps({
            "lastKnownVoucher": "",
            "detectedAction": "实物盘点发现位移，但凭证缺失",
        }),
    ),
    AnomalyRecord(
        record_id="ANO-003", asset_sn="GPU-4090-D04",
        level=AnomalyLevel.YELLOW, type=AnomalyType.HIERARCHY_PARADOX,
        description="GPU-4090-D04 已报废但仍被关联为子资产",
        conflict_payload=json.dumps({
            "parentSn": "N/A",
            "contradiction": "报废资产仍有挂载关系",
        }),
    ),
]
db.add_all(anomalies_data)

db.commit()
db.close()

print("✅ 数据库初始化完成！")
print(f"   用户: {len(users)} 条")
print(f"   资产: {len(assets)} 条")
print(f"   流水: {len(logs)} 条")
print(f"   异常: {len(anomalies_data)} 条")
print()
print("默认账号 (密码均为 123456):")
print("   李库管 WH-001 (仓管)")
print("   王仓储 WH-002 (仓管)")
print("   张台账 LG-001 (台账)")
print("   赵审计 LG-002 (台账)")
