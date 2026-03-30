import React, { useState, useCallback, useMemo } from 'react';
import { Form, Input, Select, Button, Upload, Transfer, message, Spin, Alert, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import debounce from 'lodash/debounce';
import { OperationAction, AssetStatus } from '@/core/types';
import { useDataStore } from '@/core/store/data';

interface AccessoryItem {
  key: string;
  title: string;
  description: string;
}

export default function SubmitWorkbench() {
  const [form] = Form.useForm();

  const currentAction = Form.useWatch('action', form);
  const currentCategory = Form.useWatch('category', form);
  const currentVoucherNo = Form.useWatch('voucherNo', form);
  const currentFiles = Form.useWatch('attachments', form);

  const [mountedAccessories, setMountedAccessories] = useState<AccessoryItem[]>([]);
  const [targetUnmountKeys, setTargetUnmountKeys] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // 🔴 核心风控：防抖校验资产编号 (onBlur触发)
  const validateAssetSn = useCallback(
    debounce(async (sn: string, action: OperationAction) => {
      if (!sn) return Promise.resolve();
      setIsValidating(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));

        if (sn === 'BLOCKED_SN_001') {
          return Promise.reject(new Error('阻断：该资产当前存在红灯异常(已被冻结)，禁止流转！'));
        }

        if (action === OperationAction.UNMOUNT) {
          setMountedAccessories([
            { key: 'GPU-3090-A01', title: 'RTX 3090 显卡 (SN: GPU-3090-A01)', description: '状态: IN_USE' },
            { key: 'MEM-64G-B02', title: '64G 内存条 (SN: MEM-64G-B02)', description: '状态: IN_USE' },
          ]);
        } else {
          setMountedAccessories([]);
        }

        return Promise.resolve();
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  const { submitLog } = useDataStore();

  // 🔴 核心风控：提交按钮锁定
  const isSubmitDisabled = useMemo(() => {
    if (!currentVoucherNo) return true;
    if (!currentFiles || currentFiles.length === 0) return true;
    if (currentAction === OperationAction.UNMOUNT && targetUnmountKeys.length === 0) return true;
    
    // 如果是新购入库或回收退库，必须填写资产主信息
    if (currentAction === OperationAction.INBOUND_NEW || currentAction === OperationAction.INBOUND_RECYCLE) {
      const category = form.getFieldValue('category');
      if (!category) return true;
    }
    
    return false;
  }, [currentVoucherNo, currentFiles, currentAction, targetUnmountKeys, form]);

  const onFinish = (values: any) => {
    // 简化的状态流转逻辑（实际应由后端引擎计算）
    let nextStatus: AssetStatus = AssetStatus.IN_TRANSIT;
    if (values.action === OperationAction.INBOUND_NEW || values.action === OperationAction.INBOUND_RECYCLE) {
      nextStatus = AssetStatus.IN_STOCK;
    }
    if (values.action === OperationAction.MOUNT) nextStatus = AssetStatus.IN_USE;

    submitLog({
      assetSn: values.assetSn,
      action: values.action,
      statusBefore: AssetStatus.IN_STOCK, // mock 假设
      statusAfter: nextStatus,
      voucherNo: values.voucherNo,
      submitterId: 'WH-001',
      submitterName: '张库管',
      timestamp: Date.now(),
      remarkContext: { 
        unmountChildren: targetUnmountKeys,
        brand: values.brand,
        model: values.model,
        category: values.category,
        motherboard: values.motherboard,
        cpu: values.cpu,
        ram: values.ram,
        storage: values.storage,
        gpu: values.gpu,
        notes: values.notes,
        manufactureSn: values.manufactureSn,
        targetUser: values.targetUser,
        targetDepartment: values.targetDepartment,
        targetPosition: values.targetPosition,
      }
    });
    
    message.success(`凭证单 ${values.voucherNo} 数据提报成功，已流转至台账审核池。`);
    form.resetFields();
    setTargetUnmountKeys([]);
    setMountedAccessories([]);
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <Alert
        message="风控警告"
        description="您提报的数据将作为凭证流水的底层依据，请确保凭证单真实有效。任何人不得直接修改资产台账主档。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="📥 资产异动提报单">
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ action: OperationAction.TRANSFER }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="action" label="异动操作类型" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                <Select.Option value={OperationAction.INBOUND_NEW}>✨ 新购入库</Select.Option>
                <Select.Option value={OperationAction.INBOUND_RECYCLE}>♻️ 回收退库</Select.Option>
                <Select.Option value={OperationAction.TRANSFER}>🔄 库房调配</Select.Option>
                <Select.Option value={OperationAction.MOUNT}>🔌 挂载配件 (Mount)</Select.Option>
                <Select.Option value={OperationAction.UNMOUNT}>🛠️ 拆卸配件 (Unmount)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="voucherNo"
              label="关联审批单/凭证号"
              tooltip="必须填写OA流转单号，无单号不予入账"
              rules={[{ required: true, message: '凭证号不得为空！' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="例如：OA-TRANS-20260327" />
            </Form.Item>
          </div>

          <Form.Item
            name="assetSn"
            label={currentAction === OperationAction.UNMOUNT ? '目标主机资产编号' : '操作资产编号'}
            validateTrigger="onBlur"
            hasFeedback
            rules={[
              { required: true, message: '请使用条码枪扫描或手动输入资产编号' },
              {
                validator: async (_, value) => {
                  const action = form.getFieldValue('action');
                  return validateAssetSn(value, action);
                },
              },
            ]}
          >
            <Input
              placeholder="支持条码扫码输入"
              suffix={isValidating && <Spin size="small" />}
            />
          </Form.Item>

          {/* 动态表单 1：新入库详细配置信息 (主要是新购入库) */}
          {currentAction === OperationAction.INBOUND_NEW && (
            <div style={{ background: '#fafafa', padding: 16, marginBottom: 24, borderRadius: 8 }}>
              <div style={{ marginBottom: 16, fontWeight: 500, fontSize: 16 }}>📝 新购入库：主档与配置信息填报</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Form.Item name="category" label="资产类别" required style={{ flex: '1 1 30%' }}>
                  <Select placeholder="请选择类别">
                    <Select.Option value="HOST">主机</Select.Option>
                    <Select.Option value="MONITOR">显示器</Select.Option>
                    <Select.Option value="OTHER">其他</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="brand" label="品牌" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="例如：Dell" />
                </Form.Item>
                <Form.Item name="model" label="型号" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="例如：PowerEdge R740" />
                </Form.Item>
                <Form.Item name="motherboard" label="主板" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="请填写主板型号 (选填)" />
                </Form.Item>
                <Form.Item name="cpu" label="CPU" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="请填写CPU型号及核数 (选填)" />
                </Form.Item>
                <Form.Item name="ram" label="内存" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="请填写内存总容量/规格 (选填)" />
                </Form.Item>
                <Form.Item name="storage" label="硬盘" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="请填写硬盘总容量/规格 (选填)" />
                </Form.Item>
                <Form.Item name="gpu" label="显卡" style={{ flex: '1 1 30%' }}>
                  <Input placeholder="请填写显卡型号及数量 (选填)" />
                </Form.Item>
                <Form.Item name="notes" label="备注" style={{ flex: '1 1 100%' }}>
                  <Input.TextArea placeholder="资产的其他详细参数或备注说明 (选填)" rows={2} />
                </Form.Item>
              </div>
            </div>
          )}

          {/* 回收退库简版主档信息 */}
          {currentAction === OperationAction.INBOUND_RECYCLE && (
            <div style={{ background: '#fafafa', padding: 16, marginBottom: 24, borderRadius: 8 }}>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>📝 回收资产归档补齐</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Form.Item name="category" label="资产类别" required style={{ flex: '1 1 100%' }}>
                  <Select placeholder="请选择类别">
                    <Select.Option value="HOST">主机</Select.Option>
                    <Select.Option value="MONITOR">显示器</Select.Option>
                    <Select.Option value="OTHER">其他</Select.Option>
                  </Select>
                </Form.Item>

                {currentCategory === 'HOST' && (
                  <>
                    <Form.Item name="motherboard" label="主板" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="主板型号" />
                    </Form.Item>
                    <Form.Item name="cpu" label="CPU" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="CPU型号" />
                    </Form.Item>
                    <Form.Item name="ram" label="内存" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="内存容量/规格" />
                    </Form.Item>
                    <Form.Item name="storage" label="硬盘" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="硬盘规格" />
                    </Form.Item>
                    <Form.Item name="gpu" label="显卡" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="显卡型号" />
                    </Form.Item>
                    <Form.Item name="manufactureSn" label="设备原厂SN" style={{ flex: '1 1 30%' }}>
                      <Input placeholder="设备出厂编号" />
                    </Form.Item>
                  </>
                )}

                {(currentCategory === 'MONITOR' || currentCategory === 'OTHER') && (
                  <>
                    <Form.Item name="brand" label="品牌" style={{ flex: '1 1 45%' }}>
                      <Input placeholder="例如：Dell / Lenovo" />
                    </Form.Item>
                    <Form.Item name="model" label="型号" style={{ flex: '1 1 45%' }}>
                      <Input placeholder="例如：U2419H" />
                    </Form.Item>
                  </>
                )}
              </div>
              <Form.Item name="notes" label="回收备注说明" style={{ marginBottom: 0, marginTop: 12 }}>
                <Input.TextArea placeholder="简要说明资产成色或特殊情况 (选填)" rows={1} />
              </Form.Item>
            </div>
          )}

          {/* 动态联动：库房调配 */}
          {currentAction === OperationAction.TRANSFER && (
            <div style={{ background: '#fafafa', padding: 16, marginBottom: 24, borderRadius: 8 }}>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>📝 库房调配目标信息</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <Form.Item name="targetUser" label="使用人" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input placeholder="例如：张三" />
                </Form.Item>
                <Form.Item name="targetDepartment" label="使用部门" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input placeholder="例如：技术部" />
                </Form.Item>
                <Form.Item name="targetPosition" label="岗位" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input placeholder="例如：前端开发" />
                </Form.Item>
              </div>
            </div>
          )}

          {/* 动态联动：挂载 */}
          {currentAction === OperationAction.MOUNT && (
            <Form.Item
              name="childSnsToMount"
              label="需装入的配件条码 (扫码录入)"
              rules={[{ required: true, message: '必须提供至少一个配件资产编号' }]}
            >
              <Select mode="tags" style={{ width: '100%' }} placeholder="条码枪连续扫码输入..." />
            </Form.Item>
          )}

          {/* 动态联动：拆卸穿梭框 */}
          {currentAction === OperationAction.UNMOUNT && (
            <Form.Item label="从主机已挂载配件中选择要拆卸的配件">
              <Transfer
                dataSource={mountedAccessories}
                showSearch
                filterOption={(inputValue, item) => item.title.indexOf(inputValue) > -1}
                targetKeys={targetUnmountKeys}
                onChange={(newTargetKeys) => setTargetUnmountKeys(newTargetKeys as string[])}
                render={(item) => item.title}
                listStyle={{ width: 340, height: 260 }}
                operations={['执行拆除', '撤销拆除']}
                locale={{ itemUnit: '项', itemsUnit: '项', notFoundContent: '请先输入有效的主机资产编号' }}
              />
            </Form.Item>
          )}

          <Form.Item
            name="attachments"
            label="现场交接确认单截屏 / 签字照片 (强制存档)"
            valuePropName="fileList"
            getValueFromEvent={(e: any) => (Array.isArray(e) ? e : e?.fileList)}
            rules={[{ required: true, message: '必须上传至少一张附件证明！' }]}
          >
            <Upload name="file" action="/api/mock/upload" listType="picture" beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>上传凭证影印件</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              disabled={isSubmitDisabled}
              title={isSubmitDisabled ? '请完善必填单据及附件信息' : ''}
            >
              提交风控台账审核
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
