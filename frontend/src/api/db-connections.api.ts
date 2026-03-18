import api from './client';

export interface DbConnection {
  id: string;
  label: string;
  createdAt: string;
}

export interface CreateDbConnectionDto {
  label: string;
  connectionString: string;
}

export const dbConnectionsApi = {
  list: () => api.get<DbConnection[]>('/db-connections'),
  create: (dto: CreateDbConnectionDto) => api.post<DbConnection>('/db-connections', dto),
  update: (id: string, dto: Partial<CreateDbConnectionDto>) =>
    api.patch<DbConnection>(`/db-connections/${id}`, dto),
  remove: (id: string) => api.delete(`/db-connections/${id}`),
};
