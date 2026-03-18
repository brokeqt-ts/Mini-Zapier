import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutionEngineService } from '../execution-engine.service';
import { ExecutionService } from '../execution.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('workflow')
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(
    private executionEngine: ExecutionEngineService,
    private executionService: ExecutionService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'cron-trigger') {
      const { workflowId } = job.data as { workflowId: string };
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { status: true },
      });
      if (workflow?.status !== 'ACTIVE') {
        this.logger.log(`Workflow ${workflowId} is not ACTIVE, skipping CRON trigger`);
        return;
      }
      this.logger.log(`CRON trigger for workflow ${workflowId}`);
      await this.executionService.startExecution(workflowId, {
        triggeredAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      });
      return;
    }

    const { executionId } = job.data as { executionId: string };
    this.logger.log(`Processing execution ${executionId}`);

    try {
      await this.executionEngine.run(executionId);
      this.logger.log(`Execution ${executionId} completed`);
    } catch (error) {
      this.logger.error(`Execution ${executionId} failed: ${error}`);
      throw error;
    }
  }
}
