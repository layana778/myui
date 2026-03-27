import React from 'react';
import { Table, Tag, Card, Button, Space, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDataStore, LogAuditStatus, type EnrichedAssetLog } from '@/core/store/data';
import { OperationActionLabel, AssetStatusLabel } from '@/core/types';

export default function PendingAudit() {
  const { logs, approveLog, rejectLog } = useDataStore();
  
  // 过滤出待我审核的单据
  const pendingLogs = logs.filter((log) => log.auditStatus === LogAuditStatus.PENDING);

  const handleApprove = (logId: string) => {
    approveLog(logId);
    message.success(`已同意流水 ${logId}，台账主档状态已更新！`);
  };

  const handleReject = (logId: string) => {
    rejectLog(logId);
    message.warning(`已驳回流水 ${logId}，需库管重新提交合规单据。`);
  };

  const columns: ColumnsType<EnrichedAssetLog> = [
    { title: '流水号', dataIndex: 'logId', width: 160 },
    { title: '申请资产', dataIndex: 'assetSn', width: 140, render: (v) => <a href={`/ledger/trace?sn=${v}`}>{v}</a> },
    {
      title: '申请操作', dataIndex: 'action', width: 120,
      render: (v) => <Tag color="blue">{OperationActionLabel[v as keyof typeof OperationActionLabel] || v}</Tag>,
    },
    {
      title: '预期变更状态', dataIndex: 'statusAfter', width: 120,
      render: (v) => <Tag color="green">{AssetStatusLabel[v as keyof typeof AssetStatusLabel] || v}</Tag>,
    },
    { title: 'OA凭证号', dataIndex: 'voucherNo', width: 180, render: (v) => <strong>{v}</strong> },
    { title: '提报人', dataIndex: 'submitterName', width: 90 },
    {
      title: '提报时间', dataIndex: 'timestamp', width: 160,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '审核操作 (认单防线)', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Popconfirm title="确认底层实物和凭证相符，执行入账？" onConfirm={() => handleApprove(record.logId)}>
            <Button type="primary" size="small">同意入账</Button>
          </Popconfirm>
          <Button danger size="small" onClick={() => handleReject(record.logId)}>驳回</Button>
        </Space>
      )
    }
  ];

  return (
    <Card 
      title="📑 待办审核工作台" 
      extra={
        <span style={{ color: '#888' }}>
          待审流水将直接驱动主档状态。风控原则：认单不认人，见单放行。
        </span>
      }
    >
      <Table<EnrichedAssetLog>
        columns={columns}
        dataSource={pendingLogs}
        rowKey="logId"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}
