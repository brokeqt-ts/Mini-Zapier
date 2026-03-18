import { Injectable } from '@nestjs/common';
import { NodeType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';

@Injectable()
export class DatabaseQueryExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_DB_QUERY;

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const connectionString = config.connectionString as string;
    if (!connectionString?.trim()) {
      throw new Error(
        'Узел ACTION_DB_QUERY: не заполнена строка подключения к базе данных. ' +
        'Укажите CONNECTION_STRING в настройках узла (например: postgresql://user:pass@host:5432/db)',
      );
    }

    const query = this.interpolate(config.query as string, context);
    if (!query?.trim()) {
      throw new Error('Узел ACTION_DB_QUERY: SQL-запрос не задан.');
    }

    const readOnly = config.readOnly !== false;

    const client = new PrismaClient({
      datasources: { db: { url: connectionString } },
    });

    try {
      await client.$connect();

      let result: unknown;
      if (readOnly) {
        result = await client.$queryRawUnsafe(query);
      } else {
        result = await client.$executeRawUnsafe(query);
      }

      return { rows: result, rowCount: Array.isArray(result) ? result.length : result };
    } finally {
      await client.$disconnect();
    }
  }

  private interpolate(template: string, context: ExecutionContext): string {
    if (!template) return template;
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
