import { create } from 'zustand';
import { dbConnectionsApi, DbConnection } from '../api/db-connections.api';

interface DbConnectionsState {
  connections: DbConnection[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (dto: Parameters<typeof dbConnectionsApi.create>[0]) => Promise<void>;
  update: (id: string, dto: Parameters<typeof dbConnectionsApi.update>[1]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useDbConnectionsStore = create<DbConnectionsState>((set) => ({
  connections: [],
  loaded: false,

  load: async () => {
    const { data } = await dbConnectionsApi.list();
    set({ connections: data, loaded: true });
  },

  add: async (dto) => {
    const { data } = await dbConnectionsApi.create(dto);
    set(s => ({ connections: [...s.connections, data] }));
  },

  update: async (id, dto) => {
    const { data } = await dbConnectionsApi.update(id, dto);
    set(s => ({ connections: s.connections.map(c => c.id === id ? data : c) }));
  },

  remove: async (id) => {
    await dbConnectionsApi.remove(id);
    set(s => ({ connections: s.connections.filter(c => c.id !== id) }));
  },
}));
