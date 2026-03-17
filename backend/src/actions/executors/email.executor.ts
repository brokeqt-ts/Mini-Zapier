import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';

@Injectable()
export class EmailExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_EMAIL;

  constructor(private config: ConfigService) {}

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const smtpHost =
      (config.smtpHost as string) || this.config.get('SMTP_HOST');
    const smtpPort =
      (config.smtpPort as number) || this.config.get('SMTP_PORT', 587);
    const smtpUser =
      (config.smtpUser as string) || this.config.get('SMTP_USER');
    const smtpPass =
      (config.smtpPass as string) || this.config.get('SMTP_PASS');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    const to = config.to as string;
    const subject = this.interpolate(config.subject as string, context);
    const body = this.interpolate(config.bodyTemplate as string, context);

    const info = await transporter.sendMail({
      from: smtpUser,
      to,
      subject,
      html: body,
    });

    return { messageId: info.messageId, accepted: info.accepted };
  }

  private interpolate(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
      const keys = path.trim().split('.');
      let value: unknown = context;
      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[key];
        } else {
          return '';
        }
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    });
  }
}
