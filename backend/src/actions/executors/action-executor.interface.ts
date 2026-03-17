import { NodeType } from '@prisma/client';

export interface ExecutionContext {
  trigger?: Record<string, unknown>;
  [nodeId: string]: Record<string, unknown> | undefined;
}

export interface ActionExecutor {
  readonly type: NodeType;
  execute(
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>>;
}
