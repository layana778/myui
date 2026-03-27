import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        status="403"
        title="403 权限隔离"
        subTitle="您的角色无权访问此页面。此访问已被记录至审计日志。"
        extra={<Button type="primary" onClick={() => navigate('/login')}>返回登录</Button>}
      />
    </div>
  );
}
