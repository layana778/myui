import { create } from 'zustand';
import axios from 'axios';
import type { Asset, AssetLog, AnomalyRecord } from '@/core/types';
import { AssetStatus } from '@/core/types';

export const LogAuditStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type LogAuditStatus = typeof LogAuditStatus[keyof typeof LogAuditStatus];

// The frontend relies on EnrichedAssetLog internally
export type EnrichedAssetLog = AssetLog & { auditStatus?: LogAuditStatus };

interface DataState {
  assets: Asset[];
  logs: EnrichedAssetLog[];
  anomalies: AnomalyRecord[];
  
  // 初始化获取所有数据
  fetchData: () => Promise<void>;

  submitLog: (log: any) => Promise<void>;
  approveLog: (logId: string) => Promise<void>;
  rejectLog: (logId: string) => Promise<void>;
  resolveAnomaly: (recordId: string, actionTargetState: AssetStatus, resolverVoucherNo: string) => Promise<void>;
  resolveDuplicateSn: (recordId: string, newAssetSn: string) => Promise<void>;
  rejectAnomalyToWarehouse: (recordId: string, reason: string) => Promise<void>;
  warehouseSupplementVoucher: (recordId: string, voucherNo: string) => Promise<void>;
}

// Map Backend casing (snake_case) to Frontend casing (camelCase)
const mapAsset = (apiData: any): Asset => ({
  sn: apiData.sn,
  state: apiData.state,
  latestVoucherNo: apiData.latest_voucher_no,
  parentId: apiData.parent_id,
  childrenSns: apiData.children_sns || [],
  brand: apiData.brand,
  model: apiData.model,
  category: apiData.category,
  location: apiData.location,
  motherboard: apiData.motherboard,
  cpu: apiData.cpu,
  ram: apiData.ram,
  storage: apiData.storage,
  gpu: apiData.gpu,
  notes: apiData.notes,
  versionUpdatedAt: apiData.version_updated_at,
});

const mapLog = (apiData: any): EnrichedAssetLog => ({
  logId: apiData.log_id,
  assetSn: apiData.asset_sn,
  action: apiData.action,
  statusBefore: apiData.status_before,
  statusAfter: apiData.status_after,
  voucherNo: apiData.voucher_no,
  submitterId: apiData.submitter_id,
  submitterName: apiData.submitter_name,
  timestamp: apiData.timestamp,
  remarkContext: apiData.remark_context,
  auditStatus: apiData.is_approved ? LogAuditStatus.APPROVED : LogAuditStatus.PENDING,
});

const mapAnomaly = (apiData: any): AnomalyRecord => ({
  recordId: apiData.record_id,
  assetSn: apiData.asset_sn,
  level: apiData.level,
  type: apiData.type,
  description: apiData.description,
  conflictPayload: apiData.conflict_payload ? JSON.parse(apiData.conflict_payload) : {},
  detectedAt: new Date(apiData.created_at).getTime(), // approximated
  isResolved: apiData.is_resolved,
  warehouseStatus: apiData.warehouse_status,
  warehouseRejectReason: apiData.warehouse_reject_reason,
  warehouseSupplementVoucher: apiData.warehouse_supplement_voucher,
});

export const useDataStore = create<DataState>()(
  (set) => ({
    assets: [],
    logs: [],
    anomalies: [],

    fetchData: async () => {
      try {
        const [assetsRes, logsRes, anomaliesRes] = await Promise.all([
          axios.get('/api/assets'),
          axios.get('/api/logs'),
          axios.get('/api/anomalies')
        ]);
        
        set({
          assets: assetsRes.data.map(mapAsset),
          logs: logsRes.data.map(mapLog),
          anomalies: anomaliesRes.data.map(mapAnomaly),
        });
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    },

    submitLog: async (logPayload) => {
      // Map payload to backend expectations
      const payload = {
        asset_sn: logPayload.assetSn,
        action: logPayload.action,
        status_before: logPayload.statusBefore,
        status_after: logPayload.statusAfter,
        voucher_no: logPayload.voucherNo,
        submitter_id: logPayload.submitterId,
        submitter_name: logPayload.submitterName,
        remark_context: logPayload.remarkContext || "{}",
      };
      await axios.post('/api/logs', payload);
      await useDataStore.getState().fetchData();
    },

    approveLog: async (logId) => {
      await axios.post(`/api/logs/${logId}/approve`);
      await useDataStore.getState().fetchData();
    },

    rejectLog: async (logId) => {
      await axios.post(`/api/logs/${logId}/reject`);
      await useDataStore.getState().fetchData();
    },

    resolveAnomaly: async (recordId, _, resolverVoucherNo) => {
      await axios.post(`/api/anomalies/${recordId}/resolve`, {
        voucher_no: resolverVoucherNo
      });
      await useDataStore.getState().fetchData();
    },

    resolveDuplicateSn: async (recordId, newAssetSn) => {
      await axios.post(`/api/anomalies/${recordId}/resolve-duplicate`, {
        new_asset_sn: newAssetSn,
        selected_instance: ""
      });
      await useDataStore.getState().fetchData();
    },

    rejectAnomalyToWarehouse: async (recordId, reason) => {
      await axios.post(`/api/anomalies/${recordId}/reject`, {
        reason: reason
      });
      await useDataStore.getState().fetchData();
    },

    warehouseSupplementVoucher: async (recordId, voucherNo) => {
      await axios.post(`/api/anomalies/${recordId}/supplement`, {
        voucher_no: voucherNo
      });
      await useDataStore.getState().fetchData();
    },
  })
);
