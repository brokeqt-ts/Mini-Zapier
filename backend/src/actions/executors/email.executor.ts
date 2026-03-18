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
        config = { ...config, smtpHost: account.smtpHost, smtpPort: account.smtpPort, smtpUser: account.smtpUser, smtpPass: account.smtpPass };
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

    // Resolve host to IP to bypass Node.js c-ares DNS timeout bug on Windows
    const resolvedHost = await new Promise<string>((resolve) => {
      require('dns').lookup(smtpHost, { family: 4 }, (_err: Error | null, addr: string) => {
        resolve(addr || smtpHost);
      });
    });

    const secure = smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: resolvedHost,
      port: smtpPort,
      secure,
      requireTLS: !secure,
      tls: { servername: smtpHost, rejectUnauthorized: true },
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    } as nodemailer.TransportOptions);

    const to = this.interpolate(config.to as string, context);
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
