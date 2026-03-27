import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        status="404"
        title="404"
        subTitle="您访问的页面不存在。"
        extra={<Button type="primary" onClick={() => navigate('/login')}>返回登录</Button>}
      />
    </div>
  );
}
