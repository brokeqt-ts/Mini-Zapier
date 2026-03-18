import { create } from 'zustand';
import { emailAccountsApi, EmailAccount } from '../api/email-accounts.api';

interface EmailAccountsState {
  accounts: EmailAccount[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (dto: Parameters<typeof emailAccountsApi.create>[0]) => Promise<void>;
  update: (id: string, dto: Parameters<typeof emailAccountsApi.update>[1]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useEmailAccountsStore = create<EmailAccountsState>((set, get) => ({
  accounts: [],
  loaded: false,

  load: async () => {
    const { data } = await emailAccountsApi.list();
    set({ accounts: data, loaded: true });
  },

  add: async (dto) => {
    const { data } = await emailAccountsApi.create(dto);
    set(s => ({ accounts: [...s.accounts, data] }));
  },

  update: async (id, dto) => {
    const { data } = await emailAccountsApi.update(id, dto);
    set(s => ({ accounts: s.accounts.map(a => a.id === id ? data : a) }));
  },

  remove: async (id) => {
    await emailAccountsApi.remove(id);
    set(s => ({ accounts: s.accounts.filter(a => a.id !== id) }));
  },
}));
