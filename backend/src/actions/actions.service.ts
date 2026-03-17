import { Injectable } from '@nestjs/common';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './executors/action-executor.interface';
import { HttpRequestExecutor } from './executors/http-request.executor';
import { EmailExecutor } from './executors/email.executor';
import { TelegramExecutor } from './executors/telegram.executor';
import { DatabaseQueryExecutor } from './executors/database-query.executor';
import { DataTransformExecutor } from './executors/data-transform.executor';

@Injectable()
export class ActionsService {
  private executors = new Map<NodeType, ActionExecutor>();

  constructor(
    httpExecutor: HttpRequestExecutor,
    emailExecutor: EmailExecutor,
    telegramExecutor: TelegramExecutor,
    dbExecutor: DatabaseQueryExecutor,
    transformExecutor: DataTransformExecutor,
  ) {
    this.executors.set(httpExecutor.type, httpExecutor);
    this.executors.set(emailExecutor.type, emailExecutor);
    this.executors.set(telegramExecutor.type, telegramExecutor);
    this.executors.set(dbExecutor.type, dbExecutor);
    this.executors.set(transformExecutor.type, transformExecutor);
  }

  getExecutor(type: NodeType): ActionExecutor | undefined {
    return this.executors.get(type);
  }

  async executeAction(
    type: NodeType,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No executor found for node type: ${type}`);
    }
    return executor.execute(config, context);
  }
}
