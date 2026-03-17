import { Injectable } from '@nestjs/common';
import jsonata from 'jsonata';
import { NodeType } from '@prisma/client';
import {
  ActionExecutor,
  ExecutionContext,
} from './action-executor.interface';

@Injectable()
export class DataTransformExecutor implements ActionExecutor {
  readonly type = NodeType.ACTION_DATA_TRANSFORM;

  async execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    const expression = config.expression as string;
    const compiled = jsonata(expression);
    const result = await compiled.evaluate(context);
    return { result };
  }
}
