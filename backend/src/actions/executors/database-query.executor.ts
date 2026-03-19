import { Injectable } from '@nestjs/common';
import { NodeType } from '@prisma/client';
import { Pool } from 'pg';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveContextPath } from './interpolate.util';

@Injectable()
export class DatabaseQueryExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_DB_QUERY;

  constructor(private prisma: PrismaService) {}

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    let connectionString = config.connectionString as string;

    if (config.dbConnectionId) {
      const saved = await this.prisma.dbConnection.findUnique({
        where: { id: config.dbConnectionId as string },
      });
      if (saved) connectionString = saved.connectionString;
    }

    if (!connectionString?.trim()) {
      throw new Error(
        'Узел ACTION_DB_QUERY: не заполнена строка подключения к базе данных. ' +
        'Добавьте подключение в Настройках или укажите CONNECTION_STRING вручную.',
      );
    }

    const queryTemplate = config.query as string;
    if (!queryTemplate?.trim()) {
      throw new Error('Узел ACTION_DB_QUERY: SQL-запрос не задан.');
    }

    const { sql, params } = this.buildParameterizedQuery(queryTemplate, context);

    const pool = new Pool({ connectionString });
    try {
      const result = await pool.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Converts a {{path.to.value}} template into a parameterized SQL query.
   * Each interpolated value becomes a positional parameter ($1, $2, …)
   * so user-supplied data is never concatenated directly into the SQL string.
   */
  private buildParameterizedQuery(
    template: string,
    context: ExecutionContext,
  ): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const sql = template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
      const value = resolveContextPath(path, context);
      params.push(value ?? null);
      return `$${params.length}`;
    });
    return { sql, params };
  }
}
