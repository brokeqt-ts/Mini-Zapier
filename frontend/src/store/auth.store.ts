import { create } from 'zustand';
import { authApi } from '../api/auth.api';

interface User {
  id: string;
  email: string;
  name: string | null;
  telegramChatId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpConfigured?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  isLoading: false,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('token', data.accessToken);
    set({ token: data.accessToken });
  },

  register: async (email, password, name) => {
    const { data } = await authApi.register({ email, password, name });
    localStorage.setItem('token', data.accessToken);
    set({ token: data.accessToken });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.getProfile();
      set({ user: data, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
