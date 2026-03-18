import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';

@Injectable()
export class TelegramExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_TELEGRAM;

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const botToken = config.botToken as string;
    const chatId = this.interpolate(config.chatId as string, context);
    const text = this.interpolate(config.messageTemplate as string, context);

    if (!text?.trim()) {
      throw new Error('Узел ACTION_TELEGRAM: текст сообщения не заполнен. Укажите messageTemplate в настройках узла.');
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text, parse_mode: 'HTML' },
      { timeout: 10000 },
    );

    return {
      messageId: response.data.result?.message_id,
      ok: response.data.ok,
    };
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
