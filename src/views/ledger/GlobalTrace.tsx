import React, { useState } from 'react';
import { Table, Tag, Card, Input, Timeline, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDataStore } from '@/core/store/data';
import { type AssetLog, OperationActionLabel, AssetStatusLabel } from '@/core/types';

const columns: ColumnsType<AssetLog> = [
  { title: '流水号', dataIndex: 'logId', width: 100 },
  { title: '资产编号', dataIndex: 'assetSn', width: 140 },
  {
    title: '操作类型', dataIndex: 'action', width: 120,
    render: (v) => <Tag color="blue">{OperationActionLabel[v as keyof typeof OperationActionLabel] || v}</Tag>,
  },
  {
    title: '变更前', dataIndex: 'statusBefore', width: 110,
    render: (v) => v ? AssetStatusLabel[v as keyof typeof AssetStatusLabel] || v : '-',
  },
  {
    title: '变更后', dataIndex: 'statusAfter', width: 110,
    render: (v) => <Tag color="green">{AssetStatusLabel[v as keyof typeof AssetStatusLabel] || v}</Tag>,
  },
  { title: '凭证号', dataIndex: 'voucherNo', width: 190 },
  { title: '操作人', dataIndex: 'submitterName', width: 90 },
  {
    title: '时间', dataIndex: 'timestamp', width: 170,
    render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    sorter: (a, b) => a.timestamp - b.timestamp,
    defaultSortOrder: 'descend',
  },
];

export default function GlobalTrace() {
  const [searchSn, setSearchSn] = useState('');
  const { logs } = useDataStore();

  const filteredLogs = searchSn
    ? logs.filter((log) => log.assetSn.toLowerCase().includes(searchSn.toLowerCase()))
    : logs;

  return (
    <div>
      <Card title="🔍 全局流水溯源" extra={
        <Input.Search
          placeholder="输入资产编号穿透查询"
          allowClear
          style={{ width: 300 }}
          onSearch={setSearchSn}
          onChange={(e) => { if (!e.target.value) setSearchSn(''); }}
        />
      }>
        <Table<AssetLog>
          columns={columns}
          dataSource={filteredLogs}
          rowKey="logId"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="未查询到相关流水" /> }}
        />
      </Card>

      {searchSn && filteredLogs.length > 0 && (
        <Card title={`📜 ${searchSn} 时间线`} style={{ marginTop: 16 }}>
          <Timeline
            items={filteredLogs
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((log) => ({
                color: 'blue',
                children: (
                  <div>
                    <strong>{dayjs(log.timestamp).format('YYYY-MM-DD HH:mm')}</strong>
                    {' — '}
                    {OperationActionLabel[log.action]}{' '}
                    <Tag>{log.voucherNo}</Tag>
                    <span style={{ color: '#888' }}>（操作人: {log.submitterName}）</span>
                  </div>
                ),
              }))
            }
          />
        </Card>
      )}
    </div>
  );
}
