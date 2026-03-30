/**
 * Mock 数据：用于开发环境的模拟资产与异常数据
 */
import {
  type Asset, type AssetLog, type AnomalyRecord,
  AssetStatus, OperationAction, AnomalyLevel, AnomalyType,
} from '@/core/types';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const mockAssets: Asset[] = [
  {
    sn: 'SVR-BJ-001', state: AssetStatus.IN_USE, latestVoucherNo: 'OA-TRANS-20260301',
    parentId: null, childrenSns: ['GPU-3090-A01', 'MEM-64G-B02'],
    brand: 'Dell', model: 'PowerEdge R740', category: 'SERVER', location: '北京A栋-1F-机架01', versionUpdatedAt: now - 2 * day,
  },
  {
    sn: 'GPU-3090-A01', state: AssetStatus.IN_USE, latestVoucherNo: 'OA-MNT-20260305',
    parentId: 'SVR-BJ-001', childrenSns: [],
    brand: 'NVIDIA', model: 'RTX 3090', category: 'GPU', location: '北京A栋-1F-机架01', versionUpdatedAt: now - 5 * day,
  },
  {
    sn: 'MEM-64G-B02', state: AssetStatus.IN_USE, latestVoucherNo: 'OA-MNT-20260305',
    parentId: 'SVR-BJ-001', childrenSns: [],
    brand: 'Samsung', model: 'DDR5 64GB', category: 'MEMORY', location: '北京A栋-1F-机架01', versionUpdatedAt: now - 5 * day,
  },
  {
    sn: 'GPU-A100-X03', state: AssetStatus.IN_STOCK, latestVoucherNo: 'OA-RCV-20260210',
    parentId: null, childrenSns: [],
    brand: 'NVIDIA', model: 'A100 80GB', category: 'GPU', location: '库房-IT备件区', versionUpdatedAt: now - 40 * day,
  },
  {
    sn: 'SVR-SH-002', state: AssetStatus.ANOMALY_PENDING, latestVoucherNo: 'OA-TRANS-20260201',
    parentId: null, childrenSns: ['SSD-2T-C01'],
    brand: 'HPE', model: 'ProLiant DL380', category: 'SERVER', location: '上海B栋-2F-机架12', versionUpdatedAt: now - 45 * day,
  },
  {
    sn: 'SSD-2T-C01', state: AssetStatus.ANOMALY_PENDING, latestVoucherNo: '',
    parentId: 'SVR-SH-002', childrenSns: [],
    brand: 'Samsung', model: 'PM9A3 2TB', category: 'SSD', location: '上海B栋-2F-机架12', versionUpdatedAt: now - 45 * day,
  },
  {
    sn: 'SVR-BJ-003', state: AssetStatus.IN_TRANSIT, latestVoucherNo: 'OA-TRANS-20260320',
    parentId: null, childrenSns: [],
    brand: 'Lenovo', model: 'ThinkSystem SR650', category: 'SERVER', location: '物流在途', versionUpdatedAt: now - 3 * day,
  },
  {
    sn: 'GPU-4090-D04', state: AssetStatus.SCRAPPED, latestVoucherNo: 'OA-SCRAP-20260101',
    parentId: null, childrenSns: [],
    brand: 'NVIDIA', model: 'RTX 4090', category: 'GPU', location: '报废库', versionUpdatedAt: now - 80 * day,
  },
];

export const mockLogs: AssetLog[] = [
  {
    logId: 'LOG-001', assetSn: 'SVR-BJ-001', action: OperationAction.INITIAL_ENTRY,
    statusBefore: null, statusAfter: AssetStatus.IN_STOCK,
    voucherNo: 'OA-INIT-20260101', submitterId: 'WH-001', submitterName: '张库管',
    timestamp: now - 90 * day,
  },
  {
    logId: 'LOG-002', assetSn: 'SVR-BJ-001', action: OperationAction.INBOUND_NEW,
    statusBefore: AssetStatus.IN_STOCK, statusAfter: AssetStatus.IN_USE,
    voucherNo: 'OA-TRANS-20260301', submitterId: 'WH-001', submitterName: '张库管',
    timestamp: now - 20 * day,
  },
  {
    logId: 'LOG-003', assetSn: 'GPU-3090-A01', action: OperationAction.MOUNT,
    statusBefore: AssetStatus.IN_STOCK, statusAfter: AssetStatus.IN_USE,
    voucherNo: 'OA-MNT-20260305', submitterId: 'WH-002', submitterName: '李操作员',
    timestamp: now - 15 * day,
  },
  {
    logId: 'LOG-004', assetSn: 'SVR-SH-002', action: OperationAction.TRANSFER,
    statusBefore: AssetStatus.IN_STOCK, statusAfter: AssetStatus.IN_TRANSIT,
    voucherNo: 'OA-TRANS-20260201', submitterId: 'WH-001', submitterName: '张库管',
    timestamp: now - 50 * day,
  },
  {
    logId: 'LOG-005', assetSn: 'SVR-BJ-003', action: OperationAction.TRANSFER,
    statusBefore: AssetStatus.IN_STOCK, statusAfter: AssetStatus.IN_TRANSIT,
    voucherNo: 'OA-TRANS-20260320', submitterId: 'WH-002', submitterName: '李操作员',
    timestamp: now - 3 * day,
  },
];

export const mockAnomalies: AnomalyRecord[] = [
  {
    recordId: 'ANO-001', assetSn: 'SVR-SH-002', level: AnomalyLevel.RED,
    type: AnomalyType.ORPHAN_MOVEMENT,
    conflictPayload: {
      internalLedgerSnapshot: { sn: 'SVR-SH-002', state: AssetStatus.IN_TRANSIT },
      externalIncomingData: { reported_state: 'IN_USE', location: '上海B栋', operator: '王某' },
    },
    detectedAt: now - 30 * day, isResolved: false,
  },
  {
    recordId: 'ANO-002', assetSn: 'SSD-2T-C01', level: AnomalyLevel.RED,
    type: AnomalyType.ORPHAN_MOVEMENT,
    conflictPayload: {
      internalLedgerSnapshot: { sn: 'SSD-2T-C01', state: AssetStatus.ANOMALY_PENDING, latestVoucherNo: '' },
      externalIncomingData: { action: 'mount', target_host: 'SVR-SH-002', no_voucher: true },
    },
    detectedAt: now - 30 * day, isResolved: false,
  },
  {
    recordId: 'ANO-003', assetSn: 'GPU-FAKE-999', level: AnomalyLevel.RED,
    type: AnomalyType.DUPLICATE_SN,
    conflictPayload: {
      internalLedgerSnapshot: { sn: 'GPU-FAKE-999' },
      externalIncomingData: { sn: 'GPU-FAKE-999', found_in: ['北京A栋', '上海B栋'] },
    },
    detectedAt: now - 10 * day, isResolved: false,
  },
  {
    recordId: 'ANO-004', assetSn: 'GPU-A100-X03', level: AnomalyLevel.YELLOW,
    type: AnomalyType.ORPHAN_MOVEMENT,
    conflictPayload: {
      internalLedgerSnapshot: { sn: 'GPU-A100-X03', state: AssetStatus.IN_STOCK, category: 'GPU' },
      externalIncomingData: { note: '高价值资产闲置超过30天，未挂载到任何主机' },
    },
    detectedAt: now - 40 * day, isResolved: false,
  },
];
