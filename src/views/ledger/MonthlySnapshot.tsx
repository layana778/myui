import React, { useState } from 'react';
import { Card, Button, Row, Col, Statistic, Table, Tag, message, Descriptions, Divider, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { mockAssets, mockAnomalies } from '@/core/mock/data';
import { type Asset, AssetStatus, AssetStatusLabel, AnomalyLevel } from '@/core/types';

export default function MonthlySnapshot() {
  const [isLocking, setIsLocking] = useState(false);
  const [lockedMonth, setLockedMonth] = useState<string | null>(null);

  const currentMonth = dayjs().format('YYYY-MM');
  const total = mockAssets.length;
  const inUse = mockAssets.filter((a) => a.state === AssetStatus.IN_USE).length;
  const anomaly = mockAssets.filter((a) => a.state === AssetStatus.ANOMALY_PENDING).length;
  const unresolvedRed = mockAnomalies.filter((a) => a.level === AnomalyLevel.RED && !a.isResolved).length;

  const onGenerateSnapshot = async () => {
    if (unresolvedRed > 0) {
      return message.error(`当前仍有 ${unresolvedRed} 条红灯异常未冲销，禁止封账！请先清理红灯池。`);
    }

    setIsLocking(true);
    try {
      // 模拟后端封账
      await new Promise((r) => setTimeout(r, 1500));
      
      const snapshotPayload = {
        month: currentMonth,
        generatedAt: Date.now(),
        totalAssets: total,
        inUse,
        anomalyPending: anomaly,
        assetDigest: mockAssets.map((a) => ({ sn: a.sn, state: a.state, voucher: a.latestVoucherNo })),
        fileHash: 'MD5:' + Math.random().toString(36).slice(2, 18).toUpperCase(),
      };

      console.log('[Monthly Snapshot]', snapshotPayload);
      setLockedMonth(currentMonth);
      message.success(`${currentMonth} 月度结账完毕！数据指纹已锁定，已向实物方发起确权流程。`);
    } finally {
      setIsLocking(false);
    }
  };

  const assetColumns: ColumnsType<Asset> = [
    { title: '资产编号', dataIndex: 'sn', width: 150 },
    {
      title: '状态', dataIndex: 'state', width: 120,
      render: (v: AssetStatus) => <Tag>{AssetStatusLabel[v]}</Tag>,
    },
    { title: '类别', dataIndex: 'category', width: 100 },
    { title: '品牌', dataIndex: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', width: 160 },
    { title: '凭证号', dataIndex: 'latestVoucherNo', width: 200, render: (v) => v || <Tag color="red">缺失</Tag> },
  ];

  return (
    <div>
      <h2>📸 月度对账快照 — {currentMonth}</h2>

      <Alert
        message="结账说明"
        description="封账操作将冻结当月全部资产数据为只读快照，生成数据指纹（Hash），并自动发起 OA 签批流程要求双方确权。此快照为未来扯皮时的唯一法律铁证。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="本月资产总数" value={total} /></Card></Col>
        <Col span={6}><Card><Statistic title="使用中" value={inUse} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="异常挂账" value={anomaly} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未决红灯"
              value={unresolvedRed}
              valueStyle={{ color: unresolvedRed > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix={unresolvedRed > 0 ? '(阻断封账)' : '✓'}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="当月资产清册预览"
        extra={
          <Button
            type="primary"
            danger
            loading={isLocking}
            disabled={lockedMonth === currentMonth}
            onClick={onGenerateSnapshot}
          >
            {lockedMonth === currentMonth ? `${currentMonth} 已封账 ✅` : `🔒 执行 ${currentMonth} 月度封账`}
          </Button>
        }
      >
        <Table<Asset>
          columns={assetColumns}
          dataSource={mockAssets}
          rowKey="sn"
          pagination={false}
          size="small"
        />
      </Card>

      {lockedMonth && (
        <Card style={{ marginTop: 16 }}>
          <Descriptions title="📄 封账记录" bordered column={2}>
            <Descriptions.Item label="结算月份">{lockedMonth}</Descriptions.Item>
            <Descriptions.Item label="封账时间">{dayjs().format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="资产总数">{total} 项</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color="success">已锁定 — OA 确权流程发起中</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
