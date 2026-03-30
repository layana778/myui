import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Tag, Dropdown, theme } from 'antd';
import {
  DashboardOutlined, FormOutlined, FileSearchOutlined,
  AlertOutlined, CameraOutlined, LogoutOutlined, UserOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/core/store/auth';
import { Role } from '@/core/types';

const { Header, Sider, Content } = Layout;

const warehouseMenuItems = [
  { key: '/warehouse/dashboard', icon: <DashboardOutlined />, label: '资产大盘' },
  { key: '/warehouse/submit', icon: <FormOutlined />, label: '资产异动提报' },
  { key: '/warehouse/my-logs', icon: <UnorderedListOutlined />, label: '我的提报记录' },
  { key: '/warehouse/anomaly-tasks', icon: <AlertOutlined />, label: '❌ 异常整改单' },
];

const ledgerMenuItems = [
  { key: '/ledger/dashboard', icon: <DashboardOutlined />, label: '资产大盘' },
  { key: '/ledger/audit', icon: <FormOutlined />, label: '待办单据审核' },
  { key: '/ledger/trace', icon: <FileSearchOutlined />, label: '全局流水溯源' },
  { key: '/ledger/anomaly', icon: <AlertOutlined />, label: '🚨 红黄灯风控台' },
  { key: '/ledger/snapshot', icon: <CameraOutlined />, label: '月度对账快照' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  if (!user) return <Navigate to="/login" replace />;

  const isWarehouse = user.role === Role.WAREHOUSE;
  const menuItems = isWarehouse ? warehouseMenuItems : ledgerMenuItems;
  const roleTag = isWarehouse
    ? <Tag color="blue">库管端</Tag>
    : <Tag color="volcano">台账管理</Tag>;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{ position: 'sticky', top: 0, left: 0, height: '100vh' }}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 'bold', fontSize: collapsed ? 14 : 16,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {collapsed ? '🛡️' : '🛡️ 资产风控'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            库房实物移交与台账管理系统
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {roleTag}
            <Dropdown menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: handleLogout },
              ],
            }}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: isWarehouse ? '#1677ff' : '#f5222d' }} />
                <span>{user.username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 16, padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
