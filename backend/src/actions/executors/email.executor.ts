import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_EMAIL;

  constructor(private config: ConfigService, private prisma: PrismaService) {}

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    // If emailAccountId is set, load credentials from DB
    if (config.emailAccountId) {
      const account = await this.prisma.emailAccount.findUnique({
        where: { id: config.emailAccountId as string },
      });
      if (account) {
        config = {
          ...config,
          smtpHost: account.smtpHost,
          smtpPort: account.smtpPort,
          smtpUser: account.smtpUser,
          smtpPass: account.smtpPass,
        };
      }
    }

    const smtpHost =
      (config.smtpHost as string) || this.config.get('SMTP_HOST', 'smtp.yandex.com');
    const smtpPort =
      Number((config.smtpPort as number) || this.config.get('SMTP_PORT', 465));
    const smtpUser =
      (config.smtpUser as string) || this.config.get('SMTP_USER');
    const smtpPass =
      (config.smtpPass as string) || this.config.get('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      throw new Error(
        'SMTP credentials not configured. Add an email account in Settings or set SMTP_USER/SMTP_PASS environment variables.',
      );
    }

    // Try the configured port first; if TCP connection times out, retry with the alternative port
    const ports = smtpPort === 465 ? [465, 587] : [smtpPort, 465];

    let lastError: Error | null = null;
    for (const port of ports) {
      const secure = port === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        requireTLS: !secure,
        tls: { servername: smtpHost, rejectUnauthorized: true },
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      } as nodemailer.TransportOptions);

      const to = this.interpolate(config.to as string, context);
      const subject = this.interpolate(config.subject as string, context);
      const body = this.interpolate(config.bodyTemplate as string, context);

      try {
        const info = await transporter.sendMail({
          from: smtpUser,
          to,
          subject,
          html: body,
        });
        return { messageId: info.messageId, accepted: info.accepted };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Only retry on connection-level errors, not auth/protocol errors
        const isConnectionError =
          msg.includes('timeout') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('connect');
        lastError = new Error(`SMTP ${smtpHost}:${port} — ${msg}`);
        if (!isConnectionError) break; // Auth/config error — no point retrying
      }
    }

    throw lastError ?? new Error('Failed to send email');
  }

  private interpolate(template: string, context: ExecutionContext): string {
    if (!template) return template ?? '';
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
