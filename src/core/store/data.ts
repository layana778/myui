import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockAssets, mockLogs, mockAnomalies } from '@/core/mock/data';
import type { Asset, AssetLog, AnomalyRecord } from '@/core/types';
import { AssetStatus, OperationAction, AnomalyLevel, AnomalyType, AnomalyWarehouseStatus } from '@/core/types';

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

  // 解决异常凭单：解除挂账状态并重置为主流状态
  resolveAnomaly: (recordId: string, actionTargetState: AssetStatus, resolverVoucherNo: string) => void;

  // ====== 异常专项处理 API ======
  /** 一码多机：为冲突资产重新分配自定义的新条码 */
  resolveDuplicateSn: (recordId: string, newAssetSn: string) => void;
  /** 台账管理员驳回异常至库管整改 */
  rejectAnomalyToWarehouse: (recordId: string, reason: string) => void;
  /** 库管补签凭证 */
  warehouseSupplementVoucher: (recordId: string, voucherNo: string) => void;
}

// 启动时：将"无凭证幽灵资产"自动包装为 AnomalyRecord，统一纳入异常池管理
function generateGhostAnomalies(assets: Asset[], existingAnomalies: AnomalyRecord[]): AnomalyRecord[] {
  const existingSns = new Set(existingAnomalies.map(a => a.assetSn));
  const ghostRecords: AnomalyRecord[] = [];
  assets.forEach(asset => {
    if ((!asset.latestVoucherNo || asset.latestVoucherNo.trim() === '') && !existingSns.has(asset.sn)) {
      ghostRecords.push({
        recordId: `ANO-GHOST-${asset.sn}`,
        assetSn: asset.sn,
        level: AnomalyLevel.RED,
        type: AnomalyType.ORPHAN_MOVEMENT,
        conflictPayload: {
          internalLedgerSnapshot: { sn: asset.sn, state: asset.state, latestVoucherNo: '' },
          externalIncomingData: { reason: '该资产在台账中不具备任何合法凭证，疑似未经审批入账的幽灵资产' },
        },
        detectedAt: asset.versionUpdatedAt,
        isResolved: false,
        warehouseStatus: AnomalyWarehouseStatus.PENDING,
      });
    }
  });
  return ghostRecords;
}

const initialGhostAnomalies = generateGhostAnomalies(mockAssets, mockAnomalies);

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      assets: mockAssets,
      // 初始 Mock 数据默认视为已审核通过
      logs: mockLogs.map(log => ({ ...log, auditStatus: LogAuditStatus.APPROVED })),
      anomalies: [...mockAnomalies, ...initialGhostAnomalies],

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
        // 1. 处理被操作源资产的状态变更和拆卸/挂载自身逻辑
        if (asset.sn === logToApprove.assetSn) {
          assetExists = true;

          let updatedChildrenSns = [...asset.childrenSns];
          const updatedAsset = { ...asset };

          if (logToApprove.action === OperationAction.UNMOUNT && Array.isArray(logToApprove.remarkContext?.unmountChildren)) {
            const keysToRemove = logToApprove.remarkContext.unmountChildren as string[];
            updatedChildrenSns = updatedChildrenSns.filter(child => !keysToRemove.includes(child));
            
            // 清理源主档中遗留的单独硬件文本字段
            keysToRemove.forEach(k => {
              if (k.startsWith('主板:')) updatedAsset.motherboard = undefined;
              if (k.startsWith('CPU:')) updatedAsset.cpu = undefined;
              if (k.startsWith('内存:')) updatedAsset.ram = undefined;
              if (k.startsWith('硬盘:')) updatedAsset.storage = undefined;
              if (k.startsWith('显卡:')) updatedAsset.gpu = undefined;
            });
          }

          if (logToApprove.action === OperationAction.MOUNT && logToApprove.remarkContext?.mountName) {
            const mountTag = `🔧 ${logToApprove.remarkContext.mountName} (${logToApprove.remarkContext.mountBrand || ''})`;
            updatedChildrenSns.push(mountTag);
          }

          return {
            ...updatedAsset,
            state: logToApprove.statusAfter,
            latestVoucherNo: logToApprove.voucherNo,
            childrenSns: updatedChildrenSns,
            location: (logToApprove.remarkContext?.location as string) || updatedAsset.location,
            versionUpdatedAt: Date.now()
          };
        }

        // 2. 处理同时存在的流转去向目标资产（挂载目标资产）
        if (
          logToApprove.action === OperationAction.UNMOUNT && 
          logToApprove.remarkContext?.targetMountSn &&
          asset.sn === logToApprove.remarkContext.targetMountSn
        ) {
          let targetUpdatedChildrenSns = [...asset.childrenSns];
          const targetUpdatedAsset = { ...asset };
          
          if (Array.isArray(logToApprove.remarkContext?.unmountChildren)) {
            const keysToMigrate = logToApprove.remarkContext.unmountChildren as string[];
            
            keysToMigrate.forEach(k => {
              if (!targetUpdatedChildrenSns.includes(k)) {
                targetUpdatedChildrenSns.push(k);
              }
            });

            keysToMigrate.forEach(k => {
              if (k.startsWith('主板: ')) targetUpdatedAsset.motherboard = k.replace('主板: ', '');
              if (k.startsWith('CPU: ')) targetUpdatedAsset.cpu = k.replace('CPU: ', '');
              if (k.startsWith('内存: ')) targetUpdatedAsset.ram = k.replace('内存: ', '');
              if (k.startsWith('硬盘: ')) targetUpdatedAsset.storage = k.replace('硬盘: ', '');
              if (k.startsWith('显卡: ')) targetUpdatedAsset.gpu = k.replace('显卡: ', '');
            });
          }

          return {
            ...targetUpdatedAsset,
            childrenSns: targetUpdatedChildrenSns,
            versionUpdatedAt: Date.now()
          };
        }

        return asset;
      });

      // 如果台账主档里没有这个资产（比如期初建账、新购入库），则新增一条
      if (!assetExists) {
        const newAssetSn = logToApprove.assetSn;
        const generatedChildrenSns: string[] = [];

        if (logToApprove.remarkContext?.motherboard) generatedChildrenSns.push(`主板: ${logToApprove.remarkContext.motherboard}`);
        if (logToApprove.remarkContext?.cpu) generatedChildrenSns.push(`CPU: ${logToApprove.remarkContext.cpu}`);
        if (logToApprove.remarkContext?.ram) generatedChildrenSns.push(`内存: ${logToApprove.remarkContext.ram}`);
        if (logToApprove.remarkContext?.storage) generatedChildrenSns.push(`硬盘: ${logToApprove.remarkContext.storage}`);
        if (logToApprove.remarkContext?.gpu) generatedChildrenSns.push(`显卡: ${logToApprove.remarkContext.gpu}`);

        newAssets.unshift({
          sn: newAssetSn,
          state: logToApprove.statusAfter,
          latestVoucherNo: logToApprove.voucherNo,
          parentId: null,
          childrenSns: generatedChildrenSns,
          brand: (logToApprove.remarkContext?.brand as string) || '未知品牌',
          model: (logToApprove.remarkContext?.model as string) || '未知型号',
          category: (logToApprove.remarkContext?.category as string) || 'OTHER',
          motherboard: logToApprove.remarkContext?.motherboard as string,
          cpu: logToApprove.remarkContext?.cpu as string,
          ram: logToApprove.remarkContext?.ram as string,
          storage: logToApprove.remarkContext?.storage as string,
          gpu: logToApprove.remarkContext?.gpu as string,
          notes: logToApprove.remarkContext?.notes as string,
          location: logToApprove.remarkContext?.location as string,
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
  },

  resolveAnomaly: (recordId, actionTargetState, resolverVoucherNo) => {
    set((state) => {
      const targetAnomaly = state.anomalies.find((a) => a.recordId === recordId);
      if (!targetAnomaly) return state;

      const newAnomalies = state.anomalies.map((a) => 
        a.recordId === recordId 
          ? { ...a, isResolved: true, resolverVoucherNo } 
          : a
      );

      let assetExistsInList = false;
      const newAssets = state.assets.map((asset) => {
        if (asset.sn === targetAnomaly.assetSn) {
          assetExistsInList = true;
          return {
            ...asset,
            state: actionTargetState,
            latestVoucherNo: resolverVoucherNo,
            versionUpdatedAt: Date.now(),
          };
        }
        return asset;
      });

      if (!assetExistsInList) {
        newAssets.unshift({
          sn: targetAnomaly.assetSn,
          state: actionTargetState,
          latestVoucherNo: resolverVoucherNo,
          parentId: null,
          childrenSns: [],
          brand: '异常恢复资产',
          model: '未知',
          category: 'OTHER',
          versionUpdatedAt: Date.now()
        });
      }

      return { anomalies: newAnomalies, assets: newAssets };
    });
  },

  // ====== 一码多机：重新分配条码 ======
  resolveDuplicateSn: (recordId: string, newAssetSn: string) => {
    set((state) => {
      const targetAnomaly = state.anomalies.find((a) => a.recordId === recordId);
      if (!targetAnomaly) return state;

      const originalAsset = state.assets.find((a) => a.sn === targetAnomaly.assetSn);

      // 克隆一份资产用新编号入账
      const newAssets = [...state.assets];
      if (originalAsset) {
        newAssets.unshift({
          ...originalAsset,
          sn: newAssetSn,
          state: AssetStatus.IN_STOCK,
          latestVoucherNo: `AUTO-REGEN-${Date.now()}`,
          parentId: null,
          childrenSns: [],
          versionUpdatedAt: Date.now(),
        } as Asset);
      }

      const newAnomalies = state.anomalies.map((a) =>
        a.recordId === recordId
          ? { ...a, isResolved: true, resolverVoucherNo: `重分配分号: ${newAssetSn}` }
          : a
      );

      return { anomalies: newAnomalies, assets: newAssets };
    });
  },

  // ====== 驳回至库管整改 ======
  rejectAnomalyToWarehouse: (recordId, reason) => {
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.recordId === recordId
          ? { ...a, warehouseStatus: AnomalyWarehouseStatus.REJECTED_TO_WH, warehouseRejectReason: reason }
          : a
      ),
    }));
  },

  // ====== 库管补签凭证 ======
  warehouseSupplementVoucher: (recordId, voucherNo) => {
    set((state) => {
      const targetAnomaly = state.anomalies.find((a) => a.recordId === recordId);
      if (!targetAnomaly) return state;

      const newAnomalies = state.anomalies.map((a) =>
        a.recordId === recordId
          ? {
              ...a,
              isResolved: true,
              resolverVoucherNo: voucherNo,
              warehouseStatus: AnomalyWarehouseStatus.SUBMITTED_BY_WH,
              warehouseSupplementVoucherNo: voucherNo,
            }
          : a
      );

      const newAssets = state.assets.map((asset) => {
        if (asset.sn === targetAnomaly.assetSn) {
          return {
            ...asset,
            state: AssetStatus.IN_STOCK,
            latestVoucherNo: voucherNo,
            versionUpdatedAt: Date.now(),
          };
        }
        return asset;
      });

      return { anomalies: newAnomalies, assets: newAssets };
    });
  },
}), { name: 'asset-risk-store' }));
