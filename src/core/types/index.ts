/**
 * ==========================================
 * 核心风控原则与架构共识：
 * 1. 认单不认人：人员信息（提报人）仅作事后追溯定责，系统状态流转唯一合法依据是 voucherNo（凭证单号）。
 * 2. 流水驱动状态：Asset (主档) 的状态是 AssetLog (流水) 聚合计算得来的最新快照，主档不接受业务逻辑的直接篡改。
 * 3. 无凭证不入账：任何由外部实物管理系统推送的差异数据，若找不到对应单据，一律拦截并打入 AnomalyRecord (异常池)。
 * ==========================================
 */

/**
 * 资产状态枚举
 * 风控点：状态设计需包含中间挂账状态，不符合单据预期的实物变更直接进入挂账，而非强行更新正常状态。
 */
export const AssetStatus = {
  IN_TRANSIT: 'IN_TRANSIT',
  IN_STOCK: 'IN_STOCK',
  IN_USE: 'IN_USE',
  ANOMALY_PENDING: 'ANOMALY_PENDING',
  SCRAPPED: 'SCRAPPED',
} as const;

export type AssetStatus = typeof AssetStatus[keyof typeof AssetStatus];

export const AssetStatusLabel: Record<AssetStatus, string> = {
  [AssetStatus.IN_TRANSIT]: '在途',
  [AssetStatus.IN_STOCK]: '在库/闲置',
  [AssetStatus.IN_USE]: '使用中',
  [AssetStatus.ANOMALY_PENDING]: '⚠️ 异常挂账',
  [AssetStatus.SCRAPPED]: '已报废',
};

/**
 * 核心模型 1: 资产主档 (Asset)
 */
export interface Asset {
  readonly sn: string;
  state: AssetStatus;
  readonly latestVoucherNo: string;
  parentId: string | null;
  childrenSns: string[];
  brand: string;
  model: string;
  category: string;
  motherboard?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  gpu?: string;
  notes?: string;
  readonly versionUpdatedAt: number;
}

/**
 * 业务操作类型枚举
 */
export const OperationAction = {
  INITIAL_ENTRY: 'INITIAL_ENTRY',
  INBOUND_NEW: 'INBOUND_NEW',
  INBOUND_RECYCLE: 'INBOUND_RECYCLE',
  OUTBOUND: 'OUTBOUND',
  TRANSFER: 'TRANSFER',
  MOUNT: 'MOUNT',
  UNMOUNT: 'UNMOUNT',
  AUDIT_RECTIFY: 'AUDIT_RECTIFY',
} as const;

export type OperationAction = typeof OperationAction[keyof typeof OperationAction];

export const OperationActionLabel: Record<OperationAction, string> = {
  [OperationAction.INITIAL_ENTRY]: '期初建账',
  [OperationAction.INBOUND_NEW]: '✨ 新购入库',
  [OperationAction.INBOUND_RECYCLE]: '♻️ 回收退库',
  [OperationAction.OUTBOUND]: '🚚 出库',
  [OperationAction.TRANSFER]: '🔄 库房调配',
  [OperationAction.MOUNT]: '🔌 挂载配件',
  [OperationAction.UNMOUNT]: '🛠️ 拆卸配件',
  [OperationAction.AUDIT_RECTIFY]: '盘点核销',
};

/**
 * 核心模型 2: 资产流水日志 (AssetLog)
 * "只增不改"的底层账本。
 */
export type AssetLog = Readonly<{
  logId: string;
  assetSn: string;
  action: OperationAction;
  statusBefore: AssetStatus | null;
  statusAfter: AssetStatus;
  voucherNo: string;
  submitterId: string;
  submitterName: string;
  timestamp: number;
  remarkContext?: Record<string, unknown>;
}>;

export const AnomalyLevel = {
  RED: 'RED',
  YELLOW: 'YELLOW',
} as const;

export type AnomalyLevel = typeof AnomalyLevel[keyof typeof AnomalyLevel];

export const AnomalyType = {
  DUPLICATE_SN: 'DUPLICATE_SN',
  ORPHAN_MOVEMENT: 'ORPHAN_MOVEMENT',
  NEGATIVE_INVENTORY: 'NEGATIVE_INVENTORY',
  HIERARCHY_PARADOX: 'HIERARCHY_PARADOX',
} as const;

export type AnomalyType = typeof AnomalyType[keyof typeof AnomalyType];

export const AnomalyTypeLabel: Record<AnomalyType, string> = {
  [AnomalyType.DUPLICATE_SN]: '一码多机',
  [AnomalyType.ORPHAN_MOVEMENT]: '无单据异动',
  [AnomalyType.NEGATIVE_INVENTORY]: '负库存/矛盾动作',
  [AnomalyType.HIERARCHY_PARADOX]: '层级悖论',
};

/**
 * 核心模型 3: 异常红黄灯记录 (AnomalyRecord)
 */
export interface AnomalyRecord {
  readonly recordId: string;
  readonly assetSn: string;
  readonly level: AnomalyLevel;
  readonly type: AnomalyType;
  readonly conflictPayload: {
    internalLedgerSnapshot: Partial<Asset>;
    externalIncomingData: Record<string, unknown>;
  };
  readonly detectedAt: number;
  isResolved: boolean;
  resolverVoucherNo?: string;
}

/** 角色枚举 */
export const Role = {
  WAREHOUSE: 'Role_Warehouse',
  LEDGER_ADMIN: 'Role_LedgerAdmin',
} as const;

export type Role = typeof Role[keyof typeof Role];

/** 用户信息 */
export interface UserInfo {
  userId: string;
  username: string;
  role: Role;
  avatar?: string;
}
