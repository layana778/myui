import { create } from 'zustand';
import { mockAssets, mockLogs, mockAnomalies } from '@/core/mock/data';
import type { Asset, AssetLog, AnomalyRecord } from '@/core/types';
import { AssetStatus } from '@/core/types';

export const LogAuditStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type LogAuditStatus = typeof LogAuditStatus[keyof typeof LogAuditStatus];

// 扩展原始的 AssetLog 以支持本地审核流演示
export type EnrichedAssetLog = AssetLog & { auditStatus?: LogAuditStatus };

interface DataState {
  assets: Asset[];
  logs: EnrichedAssetLog[];
  anomalies: AnomalyRecord[];
  
  // 库管提报 (新增一条待审核流水)
  submitLog: (log: Omit<EnrichedAssetLog, 'logId' | 'auditStatus'>) => void;
  
  // 台账审核通过 (根据流水更新主档)
  approveLog: (logId: string) => void;
  
  // 台账驳回
  rejectLog: (logId: string) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  assets: mockAssets,
  // 初始 Mock 数据默认视为已审核通过
  logs: mockLogs.map(log => ({ ...log, auditStatus: LogAuditStatus.APPROVED })),
  anomalies: mockAnomalies,

  submitLog: (logPayload) => {
    const newLog: EnrichedAssetLog = {
      ...logPayload,
      logId: `LOG-NEW-${Date.now()}`,
      auditStatus: LogAuditStatus.PENDING, // 初始为待审核
    };
    set((state) => ({ logs: [newLog, ...state.logs] }));
  },

  approveLog: (logId) => {
    set((state) => {
      const logToApprove = state.logs.find(l => l.logId === logId);
      if (!logToApprove) return state;

      const newLogs = state.logs.map(l => 
        l.logId === logId ? { ...l, auditStatus: LogAuditStatus.APPROVED } : l
      );

      // 核心业务推算：流水驱动主档状态改变
      let assetExists = false;
      const newAssets = state.assets.map(asset => {
        if (asset.sn === logToApprove.assetSn) {
          assetExists = true;
          return {
            ...asset,
            state: logToApprove.statusAfter,
            latestVoucherNo: logToApprove.voucherNo,
            versionUpdatedAt: Date.now()
          };
        }
        return asset;
      });

      // 如果台账主档里没有这个资产（比如期初建账、新购入库），则新增一条
      if (!assetExists) {
        newAssets.unshift({
          sn: logToApprove.assetSn,
          state: logToApprove.statusAfter,
          latestVoucherNo: logToApprove.voucherNo,
          parentId: null,
          childrenSns: [],
          brand: (logToApprove.remarkContext?.brand as string) || '未知品牌',
          model: (logToApprove.remarkContext?.model as string) || '未知型号',
          category: (logToApprove.remarkContext?.category as string) || 'OTHER',
          motherboard: logToApprove.remarkContext?.motherboard as string,
          cpu: logToApprove.remarkContext?.cpu as string,
          ram: logToApprove.remarkContext?.ram as string,
          storage: logToApprove.remarkContext?.storage as string,
          gpu: logToApprove.remarkContext?.gpu as string,
          notes: logToApprove.remarkContext?.notes as string,
          versionUpdatedAt: Date.now()
        });
      }

      return { logs: newLogs, assets: newAssets };
    });
  },

  rejectLog: (logId) => {
    set((state) => ({
      logs: state.logs.map(l => 
        l.logId === logId ? { ...l, auditStatus: LogAuditStatus.REJECTED } : l
      )
    }));
  }
}));
