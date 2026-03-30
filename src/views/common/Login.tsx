import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Typography, Space, Divider } from 'antd';
import { SafetyOutlined, AuditOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/core/store/auth';
import { Role } from '@/core/types';

const { Title, Text } = Typography;

import axios from 'axios';
import { message } from 'antd';

export default function Login() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLogin = async (role: Role) => {
    try {
      const userId = role === Role.WAREHOUSE ? 'WH-001' : 'LG-001';
      const res = await axios.post('/api/auth/login', {
        user_id: userId,
        password: '123456'
      });
      
      const APIUser = res.data.user;
      
      const user = { 
        userId: APIUser.id, 
        username: APIUser.name, 
        role: APIUser.role 
      };
      
      login(user);
      
      const redirect = searchParams.get('redirect');
      const defaultPage = user.role === Role.WAREHOUSE ? '/warehouse/submit' : '/ledger/dashboard';
      navigate(redirect || defaultPage, { replace: true });
      message.success(`欢迎回来，${user.username}！`);
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.detail || '登录失败');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0c1426 0%, #1a2742 50%, #0d1b2a 100%)',
    }}>
      <Card
        style={{ width: 460, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>🛡️ 资产风控系统</Title>
          <Text type="secondary">库房实物移交与台账管理平台</Text>
        </div>
        <Divider>选择登录身份</Divider>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Button
            icon={<SafetyOutlined />}
            size="large"
            block
            onClick={() => handleLogin(Role.WAREHOUSE)}
            style={{ height: 56, fontSize: 16 }}
          >
            🏢 对方库管（Role_Warehouse）
          </Button>
          <Button
            icon={<AuditOutlined />}
            type="primary"
            size="large"
            block
            danger
            onClick={() => handleLogin(Role.LEDGER_ADMIN)}
            style={{ height: 56, fontSize: 16 }}
          >
            🏦 我方台账负责人（Role_LedgerAdmin）
          </Button>
        </Space>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            认单不认人 · 流水驱动状态 · 无凭证不入账
          </Text>
        </div>
      </Card>
    </div>
  );
}
