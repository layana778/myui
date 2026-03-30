import React, { useMemo, useState } from 'react';
import { Table, Button, Card, Tag, Modal, Form, Input, Descriptions, Divider, Empty, message, Alert, Row } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  type AnomalyRecord, type AnomalyType,
  AnomalyTypeLabel, AnomalyWarehouseStatus,
} from '@/core/types';
import { useDataStore } from '@/core/store/data';

export default function AnomalyTasks() {
  const [supplementRecord, setSupplementRecord] = useState<AnomalyRecord | null>(null);
  const { anomalies, warehouseSupplementVoucher } = useDataStore();

  // 只展示被驳回给库管的异常工单
  const rejectedToMe = useMemo(
    () => anomalies.filter((a) => a.warehouseStatus === AnomalyWarehouseStatus.REJECTED_TO_WH && !a.isResolved),
    [anomalies],
  );

  // 已完成补签的历史记录
  const supplementedHistory = useMemo(
    () => anomalies.filter((a) => a.warehouseStatus === AnomalyWarehouseStatus.SUBMITTED_BY_WH),
    [anomalies],
  );

  const columns: ColumnsType<AnomalyRecord> = [
    { title: '工单ID', dataIndex: 'recordId', width: 150 },
    { title: '涉及资产编号', dataIndex: 'assetSn', width: 150 },
    {
      title: '异常类型',
      dataIndex: 'type',
      width: 140,
      render: (v: AnomalyType) => <Tag color="error">{AnomalyTypeLabel[v] || v}</Tag>,
    },
    {
      title: '驳回理由',
      dataIndex: 'warehouseRejectReason',
      ellipsis: true,
      render: (v) => <span style={{ color: '#cf1322' }}>{v || '-'}</span>,
    },
    {
      title: '驳回时间',
      dataIndex: 'detectedAt',
      width: 170,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => setSupplementRecord(record)}>
          补充凭证
        </Button>
      ),
    },
  ];

  const historyColumns: ColumnsType<AnomalyRecord> = [
    { title: '工单ID', dataIndex: 'recordId', width: 150 },
    { title: '涉及资产编号', dataIndex: 'assetSn', width: 150 },
    {
      title: '异常类型',
      dataIndex: 'type',
      width: 140,
      render: (v: AnomalyType) => <Tag>{AnomalyTypeLabel[v] || v}</Tag>,
    },
    {
      title: '补签凭证号',
      dataIndex: 'warehouseSupplementVoucherNo',
      render: (v) => <Tag color="green">{v}</Tag>,
    },
    {
      title: '状态',
      width: 120,
      render: () => <Tag color="success">✅ 已补签</Tag>,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>❌ 异常整改单</h2>

      <Alert
        type="warning"
        showIcon
        message="以下是台账管理员驳回至您的异常工单。"
        description="请核实实物情况后，补充缺失的OA审批凭证号完成整改。补签后异常将自动解除，资产恢复正常流转。"
        style={{ marginBottom: 16 }}
      />

      {/* 待整改工单 */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#cf1322' }}>📋 待整改工单 ({rejectedToMe.length})</h3>
        {rejectedToMe.length === 0 ? (
          <Empty description="✨ 暂无需要整改的异常工单，继续保持！" />
        ) : (
          <Table<AnomalyRecord>
            columns={columns}
            dataSource={rejectedToMe}
            rowKey="recordId"
            pagination={{ pageSize: 5 }}
            size="small"
          />
        )}
      </Card>

      {/* 已完成历史 */}
      {supplementedHistory.length > 0 && (
        <Card>
          <h3 style={{ color: '#389e0d' }}>📜 已整改历史 ({supplementedHistory.length})</h3>
          <Table<AnomalyRecord>
            columns={historyColumns}
            dataSource={supplementedHistory}
            rowKey="recordId"
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </Card>
      )}

      {/* 补签凭证弹窗 */}
      <Modal
        title={`📝 补充凭证：${supplementRecord?.assetSn}`}
        open={!!supplementRecord}
        onCancel={() => setSupplementRecord(null)}
        footer={null}
        destroyOnClose
      >
        {supplementRecord && (
          <>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工单编号">{supplementRecord.recordId}</Descriptions.Item>
              <Descriptions.Item label="涉及资产">{supplementRecord.assetSn}</Descriptions.Item>
              <Descriptions.Item label="异常类型">
                <Tag color="error">{AnomalyTypeLabel[supplementRecord.type]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="驳回理由">
                <span style={{ color: '#cf1322', fontWeight: 600 }}>{supplementRecord.warehouseRejectReason}</span>
              </Descriptions.Item>
            </Descriptions>
            <Divider />

            <Alert
              type="info"
              showIcon
              message="请前往OA系统补提审批，获得合规的凭证单号后填入下方框中。"
              style={{ marginBottom: 16 }}
            />

            <Form
              layout="vertical"
              onFinish={(values) => {
                if (supplementRecord) {
                  warehouseSupplementVoucher(supplementRecord.recordId, values.voucherNo);
                  message.success('凭证已补签！异常解除，资产恢复正常流转。');
                  setSupplementRecord(null);
                }
              }}
            >
              <Form.Item
                name="voucherNo"
                label="OA审批凭证号"
                rules={[{ required: true, message: '必须填写有效的OA审批凭证编号' }]}
              >
                <Input placeholder="例如：OA-SUPPLY-20261025" />
              </Form.Item>

              <Row justify="end">
                <Button onClick={() => setSupplementRecord(null)} style={{ marginRight: 8 }}>取消</Button>
                <Button type="primary" htmlType="submit">提交补签</Button>
              </Row>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
