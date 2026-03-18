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
    const jobName = `cron-${workflowId}`;
    for (const job of repeatableJobs) {
      const matchById  = job.id === jobName;
      const matchByKey = job.key?.includes(workflowId);
      const matchByName = job.name === 'cron-trigger' && job.key?.includes(workflowId);
      if (matchById || matchByKey || matchByName) {
        await this.workflowQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Unregistered cron for workflow ${workflowId} (key=${job.key})`);
      }
    }
  }
}
