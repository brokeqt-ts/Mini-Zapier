import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';
import { interpolate } from './interpolate.util';

@Injectable()
export class TelegramExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_TELEGRAM;

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const botToken = config.botToken as string;
    const chatId = interpolate(config.chatId as string, context);
    const text = interpolate(config.messageTemplate as string, context);

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

}

