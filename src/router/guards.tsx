import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/store/auth';
import { Role } from '@/core/types';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

/**
 * 🔒 核心路由守卫 (HOC)
 * 拦截未登录或越权访问的用户，并重定向。
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    console.warn(`[Security Alert] Role ${user.role} attempted to access ${location.pathname}`);
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

export { Role };
