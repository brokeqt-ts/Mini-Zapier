export interface HttpRequestActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface EmailActionConfig {
  to: string;
  subject: string;
  bodyTemplate: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}

export interface TelegramActionConfig {
  botToken: string;
  chatId: string;
  messageTemplate: string;
}

export interface DbQueryActionConfig {
  connectionString: string;
  query: string;
  params?: unknown[];
  readOnly?: boolean;
}

export interface DataTransformActionConfig {
  expression: string;
}
