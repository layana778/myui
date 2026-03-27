import React, { useMemo, useState } from 'react';
import { Table, Button, Card, Row, Col, Statistic, message, Badge, Tag, Modal, Descriptions, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  type Asset, type AnomalyRecord,
  AssetStatus, AssetStatusLabel, AnomalyLevel, AnomalyType, AnomalyTypeLabel,
} from '@/core/types';
import { mockAssets, mockAnomalies } from '@/core/mock/data';

export default function AnomalyRisk() {
  const [detailRecord, setDetailRecord] = useState<AnomalyRecord | null>(null);

  // =============================
  // 红灯规则引擎 (阻断级)
  // =============================
  const blockedAnomalies = useMemo(
    () => mockAnomalies.filter((a) => a.level === AnomalyLevel.RED && !a.isResolved),
    [],
  );

  const missingVoucherAssets = useMemo(
    () => mockAssets.filter((asset) => !asset.latestVoucherNo || asset.latestVoucherNo.trim() === ''),
    [],
  );

  // =============================
  // 黄灯规则引擎 (关注级)
  // =============================
  const longPendingAssets = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return mockAssets.filter(
      (asset) => asset.state === AssetStatus.ANOMALY_PENDING && asset.versionUpdatedAt < thirtyDaysAgo,
    );
  }, []);

  const orphanedValuableAssets = useMemo(
    () =>
      mockAssets.filter(
        (asset) => asset.category === 'GPU' && asset.state === AssetStatus.IN_STOCK && asset.parentId === null,
      ),
    [],
  );

  const yellowAnomalies = useMemo(
    () => mockAnomalies.filter((a) => a.level === AnomalyLevel.YELLOW && !a.isResolved),
    [],
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
  // 表格列定义
  // =============================
  const anomalyColumns: ColumnsType<AnomalyRecord> = [
    { title: '记录ID', dataIndex: 'recordId', width: 100 },
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
      title: '发现时间',
      dataIndex: 'detectedAt',
      width: 170,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => a.detectedAt - b.detectedAt,
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setDetailRecord(record)}>
          查看现场
        </Button>
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
    </div>
  );
}
