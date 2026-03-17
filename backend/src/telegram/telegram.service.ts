import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

interface PendingConnect {
  userId: string;
  expiresAt: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
  };
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly pendingCodes = new Map<string, PendingConnect>();
  private botUsername: string | null = null;
  private pollingOffset = 0;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;
    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${token}/getMe`,
        { timeout: 5000 },
      );
      this.botUsername = res.data.result.username;
      this.logger.log(`Telegram bot @${this.botUsername} ready`);
    } catch {
      this.logger.warn('Could not reach Telegram API — bot not configured');
    }
  }

  getBotUsername(): string | null {
    return this.botUsername;
  }

  isBotConfigured(): boolean {
    return !!this.config.get('TELEGRAM_BOT_TOKEN');
  }

  /** Generates a 6-digit code for the user and starts polling */
  async startConnect(userId: string): Promise<string> {
    // Lazy-fetch botUsername if not yet loaded
    if (!this.botUsername) {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
      try {
        const res = await axios.get(
          `https://api.telegram.org/bot${token}/getMe`,
          { timeout: 8000 },
        );
        this.botUsername = res.data.result.username;
      } catch (e) {
        throw new Error(`Cannot reach Telegram API: ${e}`);
      }
    }
    // Remove any existing pending code for this user
    for (const [code, val] of this.pendingCodes.entries()) {
      if (val.userId === userId) this.pendingCodes.delete(code);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingCodes.set(code, {
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    this.ensurePolling();
    return code;
  }

  /** Returns the current telegramChatId for the user */
  async getStatus(userId: string): Promise<{ connected: boolean; chatId?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    if (user?.telegramChatId) {
      return { connected: true, chatId: user.telegramChatId };
    }
    return { connected: false };
  }

  /** Removes telegram link for the user */
  async disconnect(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null },
    });
  }

  /** Send a message directly to a chatId */
  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text, parse_mode: 'HTML' },
      { timeout: 10000 },
    );
  }

  private ensurePolling() {
    if (this.pollingTimer !== null) return;
    this.schedulePoll();
  }

  private schedulePoll() {
    this.pollingTimer = setTimeout(() => this.poll(), 2000);
  }

  private async poll() {
    this.pollingTimer = null;
    this.cleanExpiredCodes();

    if (this.pendingCodes.size === 0) return; // nothing to wait for

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${token}/getUpdates`,
        {
          params: { offset: this.pollingOffset, timeout: 2, limit: 100 },
          timeout: 8000,
        },
      );

      const updates: TelegramUpdate[] = res.data.result;
      for (const update of updates) {
        this.pollingOffset = update.update_id + 1;
        await this.processUpdate(update);
      }
    } catch (err) {
      this.logger.debug(`Polling error: ${err}`);
    }

    if (this.pendingCodes.size > 0) {
      this.schedulePoll();
    }
  }

  private async processUpdate(update: TelegramUpdate) {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || !chatId) return;

    // Match "/start 123456" or just "123456"
    const match = text.match(/(?:\/start\s+)?(\d{6})/);
    if (!match) return;

    const code = match[1];
    const pending = this.pendingCodes.get(code);
    if (!pending || Date.now() > pending.expiresAt) return;

    this.pendingCodes.delete(code);

    await this.prisma.user.update({
      where: { id: pending.userId },
      data: { telegramChatId: chatId.toString() },
    });

    this.logger.log(`Telegram connected: user ${pending.userId} → chat ${chatId}`);

    try {
      await this.sendMessage(
        chatId.toString(),
        '✅ <b>Mini-Zapier подключён!</b>\nТеперь вы будете получать уведомления об ошибках ваших сценариев.',
      );
    } catch { /* ignore */ }
  }

  private cleanExpiredCodes() {
    const now = Date.now();
    for (const [code, val] of this.pendingCodes.entries()) {
      if (now > val.expiresAt) this.pendingCodes.delete(code);
    }
  }
}
