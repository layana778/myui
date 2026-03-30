import { create } from 'zustand';
import type { UserInfo } from '@/core/types';
import { Role } from '@/core/types';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (user: UserInfo) => void;
  logout: () => void;
}

// 初始化时尝试从 sessionStorage 恢复登录状态
const stored = sessionStorage.getItem('auth_user');
const initialUser: UserInfo | null = stored ? JSON.parse(stored) : null;

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  login: (user) => {
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    sessionStorage.removeItem('auth_user');
    set({ user: null, isAuthenticated: false });
  },
}));

export { Role };
