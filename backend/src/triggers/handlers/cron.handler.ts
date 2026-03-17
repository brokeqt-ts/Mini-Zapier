import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CronHandler {
  private readonly logger = new Logger(CronHandler.name);

  constructor(@InjectQueue('workflow') private workflowQueue: Queue) {}

  async register(
    workflowId: string,
    cronExpression: string,
    timezone?: string,
  ): Promise<void> {
    const jobName = `cron-${workflowId}`;

    await this.workflowQueue.add(
      'cron-trigger',
      { workflowId },
      {
        repeat: {
          pattern: cronExpression,
          ...(timezone ? { tz: timezone } : {}),
        },
        jobId: jobName,
      },
    );

    this.logger.log(
      `Registered cron "${cronExpression}" for workflow ${workflowId}`,
    );
  }

  async unregister(workflowId: string): Promise<void> {
    const repeatableJobs = await this.workflowQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `cron-${workflowId}`) {
        await this.workflowQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Unregistered cron for workflow ${workflowId}`);
      }
    }
  }
}
