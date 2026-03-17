import api from './client';

export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post<{ accessToken: string }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string }>('/auth/login', data),

  getProfile: () =>
    api.get<{ id: string; email: string; name: string | null }>('/auth/me'),
};
