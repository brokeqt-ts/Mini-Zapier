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

    const smtpHost = (config.smtpHost as string) || this.config.get('SMTP_HOST', '');
    const smtpPort = Number((config.smtpPort as number) || this.config.get('SMTP_PORT', 587));
    const smtpUser = (config.smtpUser as string) || this.config.get('SMTP_USER', '');
    const smtpPass = (config.smtpPass as string) || this.config.get('SMTP_PASS', '');

    if (!smtpHost) throw new Error('SMTP host not configured. Add an email account in Settings.');
    if (!smtpUser) throw new Error('SMTP login not configured. Add an email account in Settings.');
    if (!smtpPass) throw new Error('SMTP password / API key not configured. Add an email account in Settings.');

    const to      = this.interpolate(config.to as string, context);
    const subject = this.interpolate(config.subject as string, context);
    const body    = this.interpolate(config.bodyTemplate as string, context)
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br>\n');

    // --- HTTP API providers (bypass SMTP port restrictions) ---
    if (smtpHost === 'smtp.resend.com') {
      return this.sendViaResend(smtpPass, smtpUser, to, subject, body);
    }
    if (smtpHost === 'smtp.sendgrid.net') {
      return this.sendViaSendGrid(smtpPass, smtpUser, to, subject, body);
    }
    if (smtpHost === 'smtp-relay.brevo.com') {
      return this.sendViaBrevo(smtpPass, smtpUser, to, subject, body);
    }

    // --- Fallback: standard SMTP with port retry ---
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

      try {
        const info = await transporter.sendMail({ from: smtpUser, to, subject, html: body });
        return { messageId: info.messageId, accepted: info.accepted };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isConnectionError =
          msg.includes('timeout') || msg.includes('ECONNREFUSED') ||
          msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') ||
          msg.includes('connect');
        lastError = new Error(`SMTP ${smtpHost}:${port} — ${msg}`);
        if (!isConnectionError) break;
      }
    }

    throw lastError ?? new Error('Failed to send email');
  }

  // ── Resend ────────────────────────────────────────────────────────────────
  private async sendViaResend(
    apiKey: string, from: string, to: string, subject: string, html: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Resend API error ${res.status}: ${(err as { message?: string }).message ?? res.statusText}`);
    }
    const data = await res.json() as { id?: string };
    return { messageId: data.id ?? '', accepted: [to] };
  }

  // ── SendGrid ──────────────────────────────────────────────────────────────
  private async sendViaSendGrid(
    apiKey: string, from: string, to: string, subject: string, html: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid API error ${res.status}: ${err}`);
    }
    return { messageId: res.headers.get('x-message-id') ?? '', accepted: [to] };
  }

  // ── Brevo ─────────────────────────────────────────────────────────────────
  private async sendViaBrevo(
    apiKey: string, from: string, to: string, subject: string, html: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Brevo API error ${res.status}: ${(err as { message?: string }).message ?? res.statusText}`);
    }
    const data = await res.json() as { messageId?: string };
    return { messageId: data.messageId ?? '', accepted: [to] };
  }

  // ── interpolate ───────────────────────────────────────────────────────────
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
