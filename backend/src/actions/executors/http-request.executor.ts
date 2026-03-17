import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';

@Injectable()
export class HttpRequestExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_HTTP_REQUEST;

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const url = this.interpolate(config.url as string, context);
    const method = (config.method as string) || 'GET';
    const headers = (config.headers as Record<string, string>) || {};
    const body = config.body
      ? this.interpolate(config.body as string, context)
      : undefined;
    const timeout = (config.timeout as number) || 30000;

    const response = await axios({
      url,
      method,
      headers,
      data: body ? JSON.parse(body) : undefined,
      timeout,
    });

    return {
      status: response.status,
      headers: response.headers,
      body: response.data,
    };
  }

  private interpolate(template: string, context: ExecutionContext): string {
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
