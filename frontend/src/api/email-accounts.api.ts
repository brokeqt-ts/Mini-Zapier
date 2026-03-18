import api from './client';

export interface EmailAccount {
  id: string;
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  imapHost?: string | null;
  imapPort?: number | null;
  createdAt: string;
}

export interface CreateEmailAccountDto {
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  imapHost?: string;
  imapPort?: number;
}

export const emailAccountsApi = {
  list: () => api.get<EmailAccount[]>('/email-accounts'),
  create: (dto: CreateEmailAccountDto) => api.post<EmailAccount>('/email-accounts', dto),
  update: (id: string, dto: Partial<CreateEmailAccountDto>) => api.patch<EmailAccount>(`/email-accounts/${id}`, dto),
  remove: (id: string) => api.delete(`/email-accounts/${id}`),
};
