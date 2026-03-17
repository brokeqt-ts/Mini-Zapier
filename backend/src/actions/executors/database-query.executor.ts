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
    _context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const connectionString = config.connectionString as string;
    const query = config.query as string;
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
}
