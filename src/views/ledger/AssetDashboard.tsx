import React from 'react';
import { Table, Tag, Card, Row, Col, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDataStore } from '@/core/store/data';
import { type Asset, AssetStatus, AssetStatusLabel } from '@/core/types';

const statusColorMap: Record<AssetStatus, string> = {
  [AssetStatus.IN_TRANSIT]: 'processing',
  [AssetStatus.IN_STOCK]: 'default',
  [AssetStatus.IN_USE]: 'success',
  [AssetStatus.ANOMALY_PENDING]: 'error',
  [AssetStatus.SCRAPPED]: 'warning',
};

const columns: ColumnsType<Asset> = [
  { title: 'SN (一物一码)', dataIndex: 'sn', width: 150, fixed: 'left' },
  {
    title: '状态', dataIndex: 'state', width: 120,
    render: (v: AssetStatus) => <Tag color={statusColorMap[v]}>{AssetStatusLabel[v]}</Tag>,
    filters: Object.entries(AssetStatusLabel).map(([k, v]) => ({ text: v, value: k })),
    onFilter: (value, record) => record.state === value,
  },
  { title: '品牌', dataIndex: 'brand', width: 100 },
  { title: '型号', dataIndex: 'model', width: 160 },
  { title: '类别', dataIndex: 'category', width: 100 },
  { title: '父资产', dataIndex: 'parentId', width: 130, render: (v) => v || '-' },
  {
    title: '下属配件', dataIndex: 'childrenSns', width: 200,
    render: (v: string[]) => v.length > 0 ? v.map((s) => <Tag key={s}>{s}</Tag>) : '-',
  },
  { title: '最新凭证号', dataIndex: 'latestVoucherNo', width: 200, render: (v) => v || <Tag color="red">缺失!</Tag> },
];

export default function AssetDashboard() {
  const { assets } = useDataStore();
  const total = assets.length;
  const inUse = assets.filter((a) => a.state === AssetStatus.IN_USE).length;
  const anomaly = assets.filter((a) => a.state === AssetStatus.ANOMALY_PENDING).length;
  const inTransit = assets.filter((a) => a.state === AssetStatus.IN_TRANSIT).length;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="资产总数" value={total} /></Card></Col>
        <Col span={6}><Card><Statistic title="使用中" value={inUse} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="在途" value={inTransit} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="异常挂账" value={anomaly} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>

      <Card title="📊 资产主档全局视图（只读）">
        <Table<Asset>
          columns={columns}
          dataSource={assets}
          rowKey="sn"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
