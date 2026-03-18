import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('workflow') private workflowQueue: Queue,
  ) {}

  async startExecution(
    workflowId: string,
    triggerData?: Record<string, unknown>,
  ) {
    const triggerJson = (triggerData ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    const execution = await this.prisma.execution.create({
      data: {
        workflowId,
        triggerData: triggerData ? triggerJson : undefined,
        context: { trigger: triggerData ?? {} } as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      await this.workflowQueue.add(
        'execute-workflow',
        { executionId: execution.id },
        {
          jobId: execution.id,
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      );
    } catch (e) {
      // Mark execution as failed immediately if we can't enqueue
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: 'Queue unavailable: ' + String(e),
        },
      });
      throw e;
    }

    return execution;
  }

  async findByWorkflow(workflowId: string, userId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow || workflow.userId !== userId) {
      throw new NotFoundException('Workflow not found');
    }

    return this.prisma.execution.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id },
      include: {
        logs: { orderBy: { createdAt: 'asc' } },
        workflow: { select: { id: true, name: true, userId: true } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async cancel(id: string) {
    return this.prisma.execution.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async retry(id: string) {
    const execution = await this.findOne(id);
    return this.startExecution(
      execution.workflowId,
      execution.triggerData as Record<string, unknown> | undefined,
    );
  }

  async delete(id: string) {
    await this.prisma.executionLog.deleteMany({ where: { executionId: id } });
    return this.prisma.execution.delete({ where: { id } });
  }
}
