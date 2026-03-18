import api from './client';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  telegramChatId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpConfigured?: boolean;
}

export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post<{ accessToken: string }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string }>('/auth/login', data),

  getProfile: () =>
    api.get<UserProfile>('/auth/me'),

  updateProfile: (data: { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPass?: string }) =>
    api.patch<UserProfile>('/auth/profile', data),
};
