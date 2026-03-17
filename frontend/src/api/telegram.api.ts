import api from './client';

export const telegramApi = {
  getBotInfo: () =>
    api.get<{ configured: boolean; botUsername: string | null }>('/telegram/bot-info'),

  connect: () =>
    api.post<{ code: string; botUsername: string }>('/telegram/connect'),

  getStatus: () =>
    api.get<{ connected: boolean; chatId?: string }>('/telegram/connect/status'),

  disconnect: () => api.delete('/telegram/disconnect'),
};
