export interface WebhookTriggerConfig {
  webhookPath: string;
}

export interface CronTriggerConfig {
  cronExpression: string;
  timezone?: string;
}

export interface EmailTriggerConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  subjectFilter?: string;
  fromFilter?: string;
}
