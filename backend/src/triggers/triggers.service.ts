import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookHandler } from './handlers/webhook.handler';
import { CronHandler } from './handlers/cron.handler';
import { EmailHandler } from './handlers/email.handler';
import { NodeType, Prisma } from '@prisma/client';

@Injectable()
export class TriggersService implements OnModuleInit {
  private readonly logger = new Logger(TriggersService.name);

  constructor(
    private prisma: PrismaService,
    private webhookHandler: WebhookHandler,
    private cronHandler: CronHandler,
    private emailHandler: EmailHandler,
  ) {}

  async onModuleInit() {
    await this.recoverTriggers();
  }

  async registerTriggers(workflowId: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { nodes: true },
    });
    if (!workflow) return;

    for (const node of workflow.nodes) {
      const config = node.config as Record<string, unknown>;

      switch (node.type) {
        case NodeType.TRIGGER_WEBHOOK: {
          const webhookPath =
            (config.webhookPath as string) || workflowId;
          this.webhookHandler.register(webhookPath, workflowId, node.id);

          await this.prisma.triggerConfig.upsert({
            where: {
              workflowId_nodeId: { workflowId, nodeId: node.id },
            },
            update: {
              config: { webhookPath },
              isActive: true,
            },
            create: {
              workflowId,
              nodeId: node.id,
              type: node.type,
              config: { webhookPath },
              isActive: true,
            },
          });
          break;
        }

        case NodeType.TRIGGER_CRON: {
          const cronExpr = config.cronExpression as string;
          if (cronExpr) {
            await this.cronHandler.register(
              workflowId,
              cronExpr,
              config.timezone as string | undefined,
            );

            await this.prisma.triggerConfig.upsert({
              where: {
                workflowId_nodeId: { workflowId, nodeId: node.id },
              },
              update: {
                config: { cronExpression: cronExpr },
                isActive: true,
              },
              create: {
                workflowId,
                nodeId: node.id,
                type: node.type,
                config: { cronExpression: cronExpr },
                isActive: true,
              },
            });
          }
          break;
        }

        case NodeType.TRIGGER_EMAIL: {
          await this.emailHandler.register(workflowId, config);

          await this.prisma.triggerConfig.upsert({
            where: {
              workflowId_nodeId: { workflowId, nodeId: node.id },
            },
            update: { config: config as unknown as Prisma.InputJsonValue, isActive: true },
            create: {
              workflowId,
              nodeId: node.id,
              type: node.type,
              config: config as unknown as Prisma.InputJsonValue,
              isActive: true,
            },
          });
          break;
        }
      }
    }
  }

  async unregisterTriggers(workflowId: string): Promise<void> {
    this.webhookHandler.unregisterByWorkflow(workflowId);
    await this.cronHandler.unregister(workflowId);
    await this.emailHandler.unregister(workflowId);

    await this.prisma.triggerConfig.updateMany({
      where: { workflowId },
      data: { isActive: false },
    });
  }

  private async recoverTriggers(): Promise<void> {
    const activeTriggers = await this.prisma.triggerConfig.findMany({
      where: { isActive: true },
    });

    this.logger.log(`Recovering ${activeTriggers.length} active triggers`);

    for (const trigger of activeTriggers) {
      const config = trigger.config as Record<string, unknown>;
      try {
        switch (trigger.type) {
          case NodeType.TRIGGER_WEBHOOK:
            this.webhookHandler.register(
              config.webhookPath as string,
              trigger.workflowId,
              trigger.nodeId,
            );
            break;
          case NodeType.TRIGGER_CRON:
            await this.cronHandler.register(
              trigger.workflowId,
              config.cronExpression as string,
              config.timezone as string | undefined,
            );
            break;
          case NodeType.TRIGGER_EMAIL:
            await this.emailHandler.register(trigger.workflowId, config);
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to recover trigger ${trigger.id}: ${error}`,
        );
      }
    }
  }
}
