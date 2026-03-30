import React, { useMemo, useState } from 'react';
import { Table, Button, Card, Row, Col, Statistic, message, Badge, Tag, Modal, Descriptions, Divider, Form, Select, Input, Alert, Space, Drawer, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  type Asset, type AnomalyRecord,
  AssetStatus, AssetStatusLabel, AnomalyLevel, AnomalyType, AnomalyTypeLabel, AnomalyWarehouseStatus,
} from '@/core/types';
import { useDataStore } from '@/core/store/data';

/** 根据异常类型获取冲突说明与处理方式描述 */
function getAnomalyDescription(type: AnomalyType): { conflict: string; solutions: string[] } {
  switch (type) {
    case AnomalyType.DUPLICATE_SN:
      return {
        conflict: '系统检测到多台物理设备使用相同的出库条形码，存在复用贴码套现或错误录入风险。',
        solutions: ['为其中一台设备重新生成全新的资产编号，原机保留当前编号。'],
      };
    case AnomalyType.ORPHAN_MOVEMENT:
      return {
        conflict: '该资产发生了实物异动（位置/状态/挂载变更），但系统中找不到对应的合法OA审批单据。',
        solutions: ['由台账管理员手动补入OA凭证直接核销。', '驳回至对应仓管限期整改，要求库管补提单据。'],
      };
    case AnomalyType.NEGATIVE_INVENTORY:
      return {
        conflict: '该资产的流水序列产生了逻辑矛盾（如未入库就出库，或重复出库），导致库存为负值。',
        solutions: ['由台账管理员手动补入凭证核销。', '驳回至库管确认实际库存后重新对齐。'],
      };
    case AnomalyType.HIERARCHY_PARADOX:
      return {
        conflict: '该资产的层级关系出现悖论（如自身作为自身的父/子资产，或循环引用）。',
        solutions: ['由台账管理员手动补入凭证核销。', '驳回至库管核实挂载关系后重新上报。'],
      };
    default:
      return { conflict: '未知异常类型', solutions: ['手动核销'] };
  }
}

export default function AnomalyRisk() {
  const [detailRecord, setDetailRecord] = useState<AnomalyRecord | null>(null);
  const [resolveRecord, setResolveRecord] = useState<AnomalyRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  
  const {
    assets, anomalies,
    resolveAnomaly, resolveDuplicateSn, rejectAnomalyToWarehouse,
  } = useDataStore();

  // =============================
  // 红灯规则引擎 (阻断级)
  // =============================
  const blockedAnomalies = useMemo(
    () => anomalies.filter((a) => a.level === AnomalyLevel.RED && !a.isResolved),
    [anomalies],
  );

  const missingVoucherAssets = useMemo(
    () => assets.filter((asset) => !asset.latestVoucherNo || asset.latestVoucherNo.trim() === ''),
    [assets],
  );

  // =============================
  // 黄灯规则引擎 (关注级)
  // =============================
  const longPendingAssets = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return assets.filter(
      (asset) => asset.state === AssetStatus.ANOMALY_PENDING && asset.versionUpdatedAt < thirtyDaysAgo,
    );
  }, [assets]);

  const orphanedValuableAssets = useMemo(
    () =>
      assets.filter(
        (asset) => asset.category === 'GPU' && asset.state === AssetStatus.IN_STOCK && asset.parentId === null,
      ),
    [assets],
  );

  const yellowAnomalies = useMemo(
    () => anomalies.filter((a) => a.level === AnomalyLevel.YELLOW && !a.isResolved),
    [anomalies],
  );

  // =============================
  // 一键质询推送
  // =============================
  const triggerInquiryWebhook = async () => {
    if (blockedAnomalies.length === 0 && missingVoucherAssets.length === 0) {
      return message.info('当前红灯池清空，无需发送质询。');
    }

    const inquiryPayload = {
      title: `【高危预警】${dayjs().format('YYYY-MM-DD')} 库房账实严重冲突清单`,
      data: {
        conflicts: blockedAnomalies.map((a) => ({
          sn: a.assetSn,
          type: AnomalyTypeLabel[a.type],
          snapshot: a.conflictPayload,
        })),
        missingVouchers: missingVoucherAssets.map((a) => a.sn),
      },
      requires: '请务必在24小时内补全合规的OA冲销审批单。',
    };

    console.log('[Webhook Payload]', inquiryPayload);
    message.success('已一键发送质询卡片至【实物库管群】。');
  };

  // =============================
  // 处理核销弹窗的智能分流
  // =============================

  const handleRejectToWarehouse = () => {
    if (!resolveRecord || !rejectReason.trim()) {
      message.warning('请输入驳回理由');
      return;
    }
    rejectAnomalyToWarehouse(resolveRecord.recordId, rejectReason);
    message.success('已驳回至库管异常整改区，等待库管补签。');
    setResolveRecord(null);
    setRejectReason('');
  };

  // =============================
  // 表格列定义
  // =============================
  const anomalyColumns: ColumnsType<AnomalyRecord> = [
    { title: '记录ID', dataIndex: 'recordId', width: 130 },
    { title: '资产编号', dataIndex: 'assetSn', width: 140 },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (v: AnomalyLevel) =>
        v === AnomalyLevel.RED ? <Tag color="red">🔴 红灯</Tag> : <Tag color="orange">🟡 黄灯</Tag>,
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      width: 140,
      render: (v: AnomalyType) => AnomalyTypeLabel[v] || v,
    },
    {
      title: '库管协同',
      dataIndex: 'warehouseStatus',
      width: 120,
      render: (v?: string) => {
        if (v === AnomalyWarehouseStatus.REJECTED_TO_WH) return <Tag color="orange">⏳ 已驳回库管</Tag>;
        if (v === AnomalyWarehouseStatus.SUBMITTED_BY_WH) return <Tag color="green">✅ 库管已补签</Tag>;
        return <Tag>待处理</Tag>;
      },
    },
    {
      title: '发现时间',
      dataIndex: 'detectedAt',
      width: 170,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => a.detectedAt - b.detectedAt,
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <>
          <Button type="link" size="small" onClick={() => setDetailRecord(record)}>
            查看现场
          </Button>
          {record.warehouseStatus !== AnomalyWarehouseStatus.REJECTED_TO_WH && (
            <Button type="link" danger size="small" onClick={() => { setResolveRecord(record); setRejectReason(''); }}>
              处置
            </Button>
          )}
        </>
      ),
    },
  ];

  const assetColumns: ColumnsType<Asset> = [
    { title: '资产编号', dataIndex: 'sn', width: 140 },
    {
      title: '状态',
      dataIndex: 'state',
      width: 120,
      render: (v: AssetStatus) => <Tag color="error">{AssetStatusLabel[v]}</Tag>,
    },
    { title: '类别', dataIndex: 'category', width: 100 },
    { title: '型号', dataIndex: 'model', width: 160 },
    {
      title: '滞留天数',
      width: 100,
      render: (_, record) => {
        const days = Math.floor((Date.now() - record.versionUpdatedAt) / (24 * 60 * 60 * 1000));
        return <Tag color={days > 30 ? 'red' : 'orange'}>{days} 天</Tag>;
      },
    },
  ];

  // =============================
  // 智能核销弹窗内容 — 根据异常类型分流
  // =============================
  const renderResolveModalContent = () => {
    if (!resolveRecord) return null;
    const desc = getAnomalyDescription(resolveRecord.type);

    return (
      <>
        <Alert
          type="error"
          showIcon
          message={<strong>冲突项：{AnomalyTypeLabel[resolveRecord.type]}</strong>}
          description={desc.conflict}
          style={{ marginBottom: 16 }}
        />

        <Card size="small" title="📋 可选处置方式" style={{ marginBottom: 16 }}>
          {desc.solutions.map((s, i) => (
            <div key={i} style={{ padding: '4px 0', color: '#555' }}>
              {i + 1}. {s}
            </div>
          ))}
        </Card>

        {/* ====== 一码多机 专属处置 ====== */}
        {resolveRecord.type === AnomalyType.DUPLICATE_SN && (
          <div style={{ background: '#fffbe6', padding: 16, borderRadius: 8, border: '1px solid #ffe58f' }}>
            <div style={{ marginBottom: 12, fontWeight: 600, color: '#d48806' }}>
              🔄 系统检测到多台设备出现相同的编号 
              <a 
                onClick={() => setDetailAsset(assets.find(a => a.sn === resolveRecord.assetSn) || null)}
                style={{ marginLeft: 8, fontWeight: 'bold' }}
              >
                {resolveRecord.assetSn}
              </a>
              。请选择需要重新分配编号的实体：
            </div>
            <Form
              layout="vertical"
              onFinish={(values) => {
                if (resolveRecord) {
                  resolveDuplicateSn(resolveRecord.recordId, values.newAssetSn);
                  message.success(`已为实例 [${values.selectedInstance}] 分配新编号 ${values.newAssetSn}，冲突解除！`);
                  setResolveRecord(null);
                }
              }}
            >
              <Form.Item 
                name="selectedInstance"
                rules={[{ required: true, message: '请选择要重分配编号的实例' }]}
              >
                <Radio.Group>
                  <Space direction="vertical">
                    {(((resolveRecord.conflictPayload.externalIncomingData as any)?.found_in as string[]) || []).map((loc: string, idx: number) => (
                      <Radio key={idx} value={loc}>
                        实体 {idx + 1}：目前出现在 <strong>{loc}</strong>
                      </Radio>
                    ))}
                    <Radio value="OTHER">其他关联实体</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Row gutter={8} align="middle">
                <Col flex="auto">
                  <Form.Item
                    name="newAssetSn"
                    rules={[{ required: true, message: '必须输入新的资产编号' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="输入新的资产编号，例如 AST-NEW-02399" />
                  </Form.Item>
                </Col>
                <Col>
                  <Button type="primary" htmlType="submit">
                    确认分配
                  </Button>
                </Col>
              </Row>
            </Form>
          </div>
        )}

        {/* ====== 无单据异动 / 其他类型 专属处置 ====== */}
        {resolveRecord.type !== AnomalyType.DUPLICATE_SN && (
          <div>
            {/* 方案A: 手动补签凭证核销 */}
            <Card size="small" style={{ marginBottom: 12, border: '1px solid #91caff' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#0958d9' }}>方案A：手动补入OA凭证直接核销</div>
              <Form
                layout="inline"
                onFinish={(values) => {
                  if (resolveRecord) {
                    resolveAnomaly(resolveRecord.recordId, AssetStatus.IN_STOCK, values.resolverVoucherNo);
                    message.success('已手动补入凭证核销，异常解除！');
                    setResolveRecord(null);
                  }
                }}
              >
                <Form.Item
                  name="resolverVoucherNo"
                  rules={[{ required: true, message: '请输入凭证号' }]}
                  style={{ flex: 1 }}
                >
                  <Input placeholder="输入OA冲销单号，例如 OA-FIX-20261021" />
                </Form.Item>
                <Button type="primary" htmlType="submit">补签核销</Button>
              </Form>
            </Card>

            {/* 方案B: 驳回至库管 */}
            <Card size="small" style={{ border: '1px solid #ffccc7' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#cf1322' }}>方案B：驳回至对应仓管限期整改</div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="输入驳回理由，例如：凭证缺失，请库管核实后在24小时内补提OA审批单"
                />
                <Row justify="end">
                  <Button onClick={() => setResolveRecord(null)} style={{ marginRight: 8 }}>取消</Button>
                  <Button type="primary" danger onClick={handleRejectToWarehouse}>
                    驳回至库管
                  </Button>
                </Row>
              </Space>
            </Card>
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🛡️ 红黄灯风控台 (God View)</h2>
        <Button type="primary" danger onClick={triggerInquiryWebhook}>
          一键推送红灯质询 (钉钉/邮件)
        </Button>
      </Row>

      {/* 统计面板 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="🔴 严重冲突 (需冲销单)" value={blockedAnomalies.length} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="🔴 无凭证幽灵资产" value={missingVoucherAssets.length} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="🟡 挂账超期 (>30天)" value={longPendingAssets.length} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="🟡 高价值孤儿资产" value={orphanedValuableAssets.length + yellowAnomalies.length} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      {/* 红灯隔离池 */}
      <Card style={{ marginBottom: 16 }}>
        <h3><Badge status="error" /> 红灯隔离池明细</h3>
        <Table<AnomalyRecord>
          columns={anomalyColumns}
          dataSource={blockedAnomalies}
          rowKey="recordId"
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      {/* 无凭证幽灵资产 */}
      {missingVoucherAssets.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3><Badge status="error" /> 无凭证幽灵资产</h3>
          <Table<Asset>
            columns={assetColumns}
            dataSource={missingVoucherAssets}
            rowKey="sn"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 黄灯预警区 */}
      <Card>
        <h3><Badge status="warning" /> 黄灯预警区（挂账超期 / 高价值孤儿）</h3>
        <Table<Asset>
          columns={assetColumns}
          dataSource={[...longPendingAssets, ...orphanedValuableAssets]}
          rowKey="sn"
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      {/* 案发现场查看弹窗 */}
      <Modal
        title="📸 异常案发现场快照"
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="异常ID">{detailRecord.recordId}</Descriptions.Item>
              <Descriptions.Item label="资产编号">{detailRecord.assetSn}</Descriptions.Item>
              <Descriptions.Item label="异常类型">{AnomalyTypeLabel[detailRecord.type]}</Descriptions.Item>
              <Descriptions.Item label="发现时间">{dayjs(detailRecord.detectedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <h4>📗 我方台账数据快照</h4>
            <pre style={{ background: '#f6ffed', padding: 12, borderRadius: 6, fontSize: 12 }}>
              {JSON.stringify(detailRecord.conflictPayload.internalLedgerSnapshot, null, 2)}
            </pre>
            <h4>📕 对方接口推送数据</h4>
            <pre style={{ background: '#fff2f0', padding: 12, borderRadius: 6, fontSize: 12 }}>
              {JSON.stringify(detailRecord.conflictPayload.externalIncomingData, null, 2)}
            </pre>
          </>
        )}
      </Modal>

      {/* 智能核销弹窗 — 根据异常类型渲染不同处置方案 */}
      <Modal
        title={`⚖️ 异常处置：${resolveRecord?.assetSn} — ${resolveRecord ? AnomalyTypeLabel[resolveRecord.type] : ''}`}
        open={!!resolveRecord}
        onCancel={() => { setResolveRecord(null); setRejectReason(''); }}
        footer={null}
        destroyOnClose
        width={640}
      >
        {renderResolveModalContent()}
      </Modal>

      {/* 资产详情抽屉 */}
      <Drawer
        title={`资产配置详情 - ${detailAsset?.sn}`}
        width={500}
        placement="right"
        onClose={() => setDetailAsset(null)}
        open={!!detailAsset}
      >
        {detailAsset && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="资产编号">{detailAsset.sn}</Descriptions.Item>
            <Descriptions.Item label="资产类别">{detailAsset.category}</Descriptions.Item>
            <Descriptions.Item label="品牌">{detailAsset.brand}</Descriptions.Item>
            <Descriptions.Item label="型号">{detailAsset.model}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color="blue">{AssetStatusLabel[detailAsset.state]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="使用位置">{detailAsset.location || '未知'}</Descriptions.Item>
            <Descriptions.Item label="最新凭证单号">{detailAsset.latestVoucherNo || '无'}</Descriptions.Item>
            
            <Descriptions.Item label="主板">
              {detailAsset.motherboard || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="CPU">
              {detailAsset.cpu || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="内存 (RAM)">
              {detailAsset.ram || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="硬盘 (Storage)">
              {detailAsset.storage || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="显卡 (GPU)">
              {detailAsset.gpu || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="父级挂载">
              {detailAsset.parentId || '独立使用'}
            </Descriptions.Item>
            <Descriptions.Item label="下属配件">
              {detailAsset.childrenSns?.length > 0 ? detailAsset.childrenSns.join(', ') : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {detailAsset.notes || '无'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
