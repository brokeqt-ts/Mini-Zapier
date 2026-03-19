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
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email, password) => {
    await authApi.login({ email, password });
    // Cookie is set by the server; load profile to populate state.
    const { data } = await authApi.getProfile();
    set({ user: data });
  },

  register: async (email, password, name) => {
    await authApi.register({ email, password, name });
    const { data } = await authApi.getProfile();
    set({ user: data });
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null });
  },

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.getProfile();
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
