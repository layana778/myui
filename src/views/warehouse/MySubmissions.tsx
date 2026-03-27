import React from 'react';
import { Table, Tag, Card, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDataStore, LogAuditStatus, type EnrichedAssetLog } from '@/core/store/data';
import { OperationActionLabel, AssetStatusLabel } from '@/core/types';

const columns: ColumnsType<EnrichedAssetLog> = [
  { title: '流水号', dataIndex: 'logId', width: 130 },
  { title: '资产编号', dataIndex: 'assetSn', width: 140 },
  {
    title: '操作类型', dataIndex: 'action', width: 120,
    render: (v) => <Tag color="blue">{OperationActionLabel[v as keyof typeof OperationActionLabel] || v}</Tag>,
  },
  {
    title: '变更后状态', dataIndex: 'statusAfter', width: 110,
    render: (v) => <Tag color="green">{AssetStatusLabel[v as keyof typeof AssetStatusLabel] || v}</Tag>,
  },
  { title: '凭证号', dataIndex: 'voucherNo', width: 180 },
  {
    title: '台账审核状态', dataIndex: 'auditStatus', width: 120, fixed: 'right',
    render: (v) => {
      if (v === LogAuditStatus.APPROVED) return <Tag color="success">已入账</Tag>;
      if (v === LogAuditStatus.REJECTED) return <Tag color="error">被驳回</Tag>;
      return <Tag color="warning">待审核</Tag>;
    }
  },
  {
    title: '提报时间', dataIndex: 'timestamp', width: 160,
    render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
  },
];

export default function MySubmissions() {
  const { logs } = useDataStore();
  const myLogs = logs.filter((log) => log.submitterId === 'WH-001');

  return (
    <Card title="📋 我的提报记录" extra="展示向台账中心发送的流转凭据审核状态">
      <Table<EnrichedAssetLog>
        columns={columns}
        dataSource={myLogs}
        rowKey="logId"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无提报记录" /> }}
      />
    </Card>
  );
}
