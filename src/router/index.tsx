import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { AuthGuard, Role } from './guards';
import AppLayout from '@/components/Layout';

// 懒加载公共页面
const Login = lazy(() => import('@/views/common/Login'));
const Unauthorized = lazy(() => import('@/views/common/Unauthorized'));
const NotFound = lazy(() => import('@/views/common/NotFound'));

// 🏢 懒加载：库管页面 (打包时分离为 chunk-warehouse)
const SubmitWorkbench = lazy(() => import('@/views/warehouse/SubmitWorkbench'));
const MySubmissions = lazy(() => import('@/views/warehouse/MySubmissions'));

// 🏦 懒加载：台账管理员页面 (打包时分离为 chunk-ledger)
const AssetDashboard = lazy(() => import('@/views/ledger/AssetDashboard'));
const PendingAudit = lazy(() => import('@/views/ledger/PendingAudit'));
const GlobalTrace = lazy(() => import('@/views/ledger/GlobalTrace'));
const AnomalyRisk = lazy(() => import('@/views/ledger/AnomalyRisk'));
const MonthlySnapshot = lazy(() => import('@/views/ledger/MonthlySnapshot'));

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  { path: '/login', element: <Wrap><Login /></Wrap> },
  { path: '/403', element: <Wrap><Unauthorized /></Wrap> },
  { path: '/404', element: <Wrap><NotFound /></Wrap> },

  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },

      // 🏢 对方库管隔离区
      {
        path: 'warehouse',
        element: (
          <AuthGuard allowedRoles={[Role.WAREHOUSE]}>
            <Outlet />
          </AuthGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/warehouse/submit" replace /> },
          { path: 'submit', element: <Wrap><SubmitWorkbench /></Wrap> },
          { path: 'my-logs', element: <Wrap><MySubmissions /></Wrap> },
        ],
      },

      // 🏦 台账风控隔离区
      {
        path: 'ledger',
        element: (
          <AuthGuard allowedRoles={[Role.LEDGER_ADMIN]}>
            <Outlet />
          </AuthGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/ledger/dashboard" replace /> },
          { path: 'dashboard', element: <Wrap><AssetDashboard /></Wrap> },
          { path: 'audit', element: <Wrap><PendingAudit /></Wrap> },
          { path: 'trace', element: <Wrap><GlobalTrace /></Wrap> },
          { path: 'anomaly', element: <Wrap><AnomalyRisk /></Wrap> },
          { path: 'snapshot', element: <Wrap><MonthlySnapshot /></Wrap> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/404" replace /> },
]);
