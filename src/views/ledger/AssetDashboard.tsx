import React, { useState } from 'react';
import { Table, Tag, Card, Row, Col, Statistic, Input, Drawer, Descriptions } from 'antd';
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

export default function AssetDashboard() {
  const [searchSn, setSearchSn] = useState('');
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const { assets } = useDataStore();

  const filteredAssets = searchSn
    ? assets.filter((asset) => asset.sn.toLowerCase().includes(searchSn.toLowerCase()))
    : assets;

  const total = filteredAssets.length;
  const inUse = filteredAssets.filter((a) => a.state === AssetStatus.IN_USE).length;
  const anomaly = assets.filter((a) => a.state === AssetStatus.ANOMALY_PENDING).length;
  const inTransit = assets.filter((a) => a.state === AssetStatus.IN_TRANSIT).length;

  const columns: ColumnsType<Asset> = [
    { 
      title: '资产编号', 
      dataIndex: 'sn', 
      width: 150, 
      fixed: 'left',
      render: (v, record) => <a onClick={() => setDetailAsset(record)}>{v}</a>
    },
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

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="资产总数" value={total} /></Card></Col>
        <Col span={6}><Card><Statistic title="使用中" value={inUse} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="在途" value={inTransit} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="异常挂账" value={anomaly} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>

      <Card 
        title="📊 资产主档全局视图（只读）" 
        extra={
          <Input.Search
            placeholder="输入资产编号查询"
            onSearch={setSearchSn}
            onChange={(e) => { if (!e.target.value) setSearchSn(''); }}
            style={{ width: 250 }}
            allowClear
          />
        }
      >
        <Table<Asset>
          columns={columns}
          dataSource={filteredAssets}
          rowKey="sn"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

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
              <Tag color={statusColorMap[detailAsset.state]}>{AssetStatusLabel[detailAsset.state]}</Tag>
            </Descriptions.Item>
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
