import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private config: ConfigService) {}

  async notifyWorkflowError(
    userEmail: string,
    workflowName: string,
    errorMessage: string,
    executionId: string,
    userTelegramChatId?: string | null,
  ): Promise<void> {
    await Promise.allSettled([
      this.sendEmailNotification(
        userEmail,
        workflowName,
        errorMessage,
        executionId,
      ),
      this.sendTelegramNotification(
        workflowName,
        errorMessage,
        executionId,
        userTelegramChatId,
      ),
    ]);
  }

  async notifyWorkflowPaused(
    userEmail: string,
    workflowName: string,
    userTelegramChatId?: string | null,
  ): Promise<void> {
    const subject = `Workflow "${workflowName}" auto-paused`;
    const body = `
      <h3>Workflow Auto-Paused</h3>
      <p>Your workflow <strong>"${workflowName}"</strong> has been automatically paused
      after 5 consecutive failed executions.</p>
      <p>Please check the execution logs, fix the issue, and re-activate the workflow.</p>
    `;

    await Promise.allSettled([
      this.sendEmail(userEmail, subject, body),
      this.sendTelegram(
        `⏸ Сценарий <b>"${workflowName}"</b> автоматически приостановлен после 5 подряд неудачных запусков. Проверьте логи и активируйте снова.`,
        userTelegramChatId,
      ),
    ]);
  }

  private async sendEmailNotification(
    to: string,
    workflowName: string,
    errorMessage: string,
    executionId: string,
  ): Promise<void> {
    const subject = `Workflow "${workflowName}" execution failed`;
    const body = `
      <h3>Workflow Execution Failed</h3>
      <p><strong>Workflow:</strong> ${workflowName}</p>
      <p><strong>Execution ID:</strong> ${executionId}</p>
      <p><strong>Error:</strong> ${errorMessage}</p>
      <p>Check the execution logs for more details.</p>
    `;

    await this.sendEmail(to, subject, body);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const smtpHost = this.config.get('SMTP_HOST');
    if (!smtpHost) {
      this.logger.debug('SMTP not configured, skipping email notification');
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.config.get('SMTP_PORT', 587),
        secure: this.config.get('SMTP_PORT') === '465',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });

      await transporter.sendMail({
        from: this.config.get('SMTP_USER'),
        to,
        subject,
        html,
      });

      this.logger.log(`Error notification email sent to ${to}`);
    } catch (error) {
      this.logger.warn(`Failed to send email notification: ${error}`);
    }
  }

  private async sendTelegramNotification(
    workflowName: string,
    errorMessage: string,
    executionId: string,
    userChatId?: string | null,
  ): Promise<void> {
    const message =
      `❌ <b>Сценарий завершился с ошибкой</b>\n` +
      `<b>Сценарий:</b> ${workflowName}\n` +
      `<b>ID запуска:</b> <code>${executionId.slice(0, 8)}</code>\n` +
      `<b>Ошибка:</b> ${errorMessage}`;

    await this.sendTelegram(message, userChatId);
  }

  private async sendTelegram(message: string, userChatId?: string | null): Promise<void> {
    const botToken = this.config.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.debug('Telegram bot token not configured, skipping');
      return;
    }

    // Prefer user's personal chat, fall back to global notify chat
    const chatId = userChatId || this.config.get('TELEGRAM_NOTIFY_CHAT_ID');
    if (!chatId) {
      this.logger.debug('No Telegram chat ID available, skipping notification');
      return;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: chatId, text: message, parse_mode: 'HTML' },
        { timeout: 10000 },
      );

      this.logger.log(`Telegram notification sent to chat ${chatId}`);
    } catch (error) {
      this.logger.warn(`Failed to send Telegram notification: ${error}`);
    }
  }
}
