import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsService } from '../actions/actions.service';
import { ExecutionLoggerService } from '../logging/execution-logger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { ExecutionContext } from '../actions/executors/action-executor.interface';
import { WorkflowNode, WorkflowEdge, NodeType } from '@prisma/client';

const TRIGGER_TYPES: NodeType[] = [
  NodeType.TRIGGER_WEBHOOK,
  NodeType.TRIGGER_CRON,
  NodeType.TRIGGER_EMAIL,
];

/**
 * Converts a node label to a valid context key.
 * Must stay in sync with nodeToContextKey() in frontend fieldSuggestions.ts.
 */
function nodeToContextKey(label: string): string {
  return (label || 'node')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0400-\u04FF]/g, '')
    || 'node';
}

/**
 * Builds a map from node.id → context key, resolving duplicate label collisions.
 */
function buildContextKeyMap(nodes: WorkflowNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedKeys = new Set<string>();
  for (const node of nodes) {
    if (TRIGGER_TYPES.includes(node.type)) {
      map.set(node.id, 'trigger');
      continue;
    }
    const base = nodeToContextKey(node.label);
    let key = base;
    let i = 2;
    while (usedKeys.has(key)) {
      key = `${base}_${i++}`;
    }
    usedKeys.add(key);
    map.set(node.id, key);
  }
  return map;
}

interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

@Injectable()
export class ExecutionEngineService {
  private readonly logger = new Logger(ExecutionEngineService.name);

  constructor(
    private prisma: PrismaService,
    private actionsService: ActionsService,
    private executionLogger: ExecutionLoggerService,
    private notifications: NotificationsService,
    private config: ConfigService,
    private crypto: CryptoService,
  ) {}

  async run(executionId: string): Promise<void> {
    this.logger.log(`[run] Loading execution ${executionId}`);
    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          include: { nodes: true, edges: true },
        },
      },
    });

    if (!execution) throw new Error(`Execution ${executionId} not found`);
    this.logger.log(
      `[run] Found execution ${executionId}, workflow=${execution.workflowId}, ` +
      `nodes=${execution.workflow.nodes.length}, edges=${execution.workflow.edges.length}`,
    );

    await this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    this.logger.log(`[run] Status set to RUNNING for ${executionId}`);

    const { nodes, edges } = execution.workflow;
    const context: ExecutionContext = (execution.context as ExecutionContext) || {
      trigger: execution.triggerData ?? {},
    };
    const contextKeyMap = buildContextKeyMap(nodes);

    try {
      const sortedNodes = this.topologicalSort(nodes, edges);

      for (const node of sortedNodes) {
        if (TRIGGER_TYPES.includes(node.type)) {
          await this.executionLogger.log(
            executionId,
            node.id,
            'INFO',
            `Trigger node: ${node.label}`,
          );
          continue;
        }

        const shouldExecute = this.evaluateConditions(node.id, edges, context);
        if (!shouldExecute) {
          await this.executionLogger.log(
            executionId,
            node.id,
            'INFO',
            `Skipped: condition not met`,
          );
          continue;
        }

        const nodeConfig = await this.resolveNodeConfig(
          node.config as Record<string, unknown>,
          node.type,
          execution.workflow.userId,
        );
        const retryConfig = this.getRetryConfig(nodeConfig);
        const contextKey = contextKeyMap.get(node.id) ?? node.id;

        await this.executeNodeWithRetry(
          executionId,
          node,
          nodeConfig,
          context,
          retryConfig,
          contextKey,
        );
      }

      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          context: context as object,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage,
          context: context as object,
        },
      });

      // Send error notification to workflow owner
      const user = await this.prisma.user.findUnique({
        where: { id: execution.workflow.userId },
        select: { email: true, telegramChatId: true },
      });
      if (user) {
        await this.notifications.notifyWorkflowError(
          user.email,
          execution.workflow.name,
          errorMessage,
          executionId,
          user.telegramChatId,
        );
      }

      await this.checkAutoPause(execution.workflowId, execution.workflow.name);
      throw error;
    }
  }

  private async executeNodeWithRetry(
    executionId: string,
    node: WorkflowNode,
    config: Record<string, unknown>,
    context: ExecutionContext,
    retry: RetryConfig,
    contextKey: string,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      const start = Date.now();

      try {
        await this.executionLogger.log(
          executionId,
          node.id,
          'INFO',
          `Executing ${node.label} (attempt ${attempt}/${retry.maxAttempts})`,
          { input: config },
        );

        const result = await this.actionsService.executeAction(
          node.type,
          config,
          context,
        );

        context[contextKey] = result;
        const duration = Date.now() - start;

        await this.executionLogger.log(
          executionId,
          node.id,
          'INFO',
          `Completed ${node.label} in ${duration}ms`,
          { output: result, durationMs: duration },
        );

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - start;

        await this.executionLogger.log(
          executionId,
          node.id,
          'ERROR',
          `Failed ${node.label} (attempt ${attempt}): ${lastError.message}`,
          { error: lastError.message, durationMs: duration },
        );

        if (attempt < retry.maxAttempts) {
          const delay =
            retry.backoffMs * Math.pow(retry.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private topologicalSort(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const nodeMap = new Map<string, WorkflowNode>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
      nodeMap.set(node.id, node);
    }

    for (const edge of edges) {
      const targets = adjacency.get(edge.sourceNodeId);
      if (targets) targets.push(edge.targetNodeId);
      inDegree.set(
        edge.targetNodeId,
        (inDegree.get(edge.targetNodeId) || 0) + 1,
      );
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted: WorkflowNode[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) sorted.push(node);

      for (const targetId of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(targetId) || 1) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) queue.push(targetId);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Workflow contains a cycle');
    }

    return sorted;
  }

  /**
   * Blocked token list for condition expressions.
   * Prevents access to Node.js globals, prototype chains, and dynamic code execution.
   */
  private static readonly CONDITION_BLOCKED =
    /\b(eval|Function|require|import|process|global|globalThis|window|document|__proto__|constructor|prototype|fetch|XMLHttpRequest|setTimeout|setInterval|clearTimeout|clearInterval|Buffer|module|exports)\b/;

  private evaluateConditions(
    nodeId: string,
    edges: WorkflowEdge[],
    context: ExecutionContext,
  ): boolean {
    const incomingEdges = edges.filter((e) => e.targetNodeId === nodeId);
    if (incomingEdges.length === 0) return true;

    return incomingEdges.some((edge) => {
      if (!edge.conditionExpr) return true;
      try {
        if (ExecutionEngineService.CONDITION_BLOCKED.test(edge.conditionExpr)) {
          this.logger.warn(
            `Condition for edge ${edge.id} contains forbidden token — skipping`,
          );
          return false;
        }
        // new Function is intentionally used here after blocklist validation.
        // The expression may only reference the `context` argument; all dangerous
        // globals are blocked above.
        // eslint-disable-next-line no-new-func
        const fn = new Function('context', `"use strict";\nreturn Boolean(${edge.conditionExpr});`);
        return fn(context);
      } catch {
        this.logger.warn(
          `Failed to evaluate condition for edge ${edge.id}: ${edge.conditionExpr}`,
        );
        return true;
      }
    });
  }

  private async resolveNodeConfig(
    config: Record<string, unknown>,
    nodeType: NodeType,
    userId: string,
  ): Promise<Record<string, unknown>> {
    if (nodeType === NodeType.ACTION_EMAIL && config.useUserAccount) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true },
      });
      if (!user?.smtpUser) {
        throw new Error('Email не настроен. Настройте почту в разделе Настройки.');
      }
      return {
        ...config,
        smtpHost: user.smtpHost,
        smtpPort: user.smtpPort,
        smtpUser: user.smtpUser,
        smtpPass: user.smtpPass ? this.crypto.decrypt(user.smtpPass) : null,
      };
    }

    if (nodeType === NodeType.ACTION_TELEGRAM && config.useUserAccount) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true },
      });
      if (!user?.telegramChatId) {
        throw new Error('Telegram не подключён. Подключите Telegram в настройках профиля.');
      }
      return {
        ...config,
        botToken: this.config.get('TELEGRAM_BOT_TOKEN'),
        chatId: user.telegramChatId,
      };
    }
    return config;
  }

  private getRetryConfig(config: Record<string, unknown>): RetryConfig {
    const retry = config.retry as Record<string, unknown> | undefined;
    return {
      maxAttempts: (retry?.maxAttempts as number) || 1,
      backoffMs: (retry?.backoffMs as number) || 1000,
      backoffMultiplier: (retry?.backoffMultiplier as number) || 2,
    };
  }

  private async checkAutoPause(
    workflowId: string,
    workflowName: string,
  ): Promise<void> {
    const recentExecutions = await this.prisma.execution.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true },
    });

    const allFailed =
      recentExecutions.length >= 5 &&
      recentExecutions.every((e) => e.status === 'FAILED');

    if (allFailed) {
      const workflow = await this.prisma.workflow.update({
        where: { id: workflowId },
        data: { status: 'PAUSED' },
        include: { user: { select: { email: true, telegramChatId: true } } },
      });

      this.logger.warn(
        `Workflow ${workflowId} auto-paused after 5 consecutive failures`,
      );

      await this.notifications.notifyWorkflowPaused(
        workflow.user.email,
        workflowName,
        workflow.user.telegramChatId,
      );
    }
  }
}
