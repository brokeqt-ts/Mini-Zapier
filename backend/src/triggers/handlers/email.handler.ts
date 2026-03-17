import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface EmailTriggerConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  subjectFilter?: string;
  fromFilter?: string;
}

@Injectable()
export class EmailHandler {
  private readonly logger = new Logger(EmailHandler.name);

  constructor(@InjectQueue('workflow') private workflowQueue: Queue) {}

  async register(
    workflowId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const jobName = `email-poll-${workflowId}`;

    await this.workflowQueue.add(
      'email-poll',
      {
        workflowId,
        imapHost: config.imapHost,
        imapPort: config.imapPort || 993,
        imapUser: config.imapUser,
        imapPass: config.imapPass,
        subjectFilter: config.subjectFilter,
        fromFilter: config.fromFilter,
      },
      {
        repeat: { every: 60000 },
        jobId: jobName,
      },
    );

    this.logger.log(
      `Registered email polling (every 60s) for workflow ${workflowId}`,
    );
  }

  async unregister(workflowId: string): Promise<void> {
    const repeatableJobs = await this.workflowQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `email-poll-${workflowId}`) {
        await this.workflowQueue.removeRepeatableByKey(job.key);
        this.logger.log(
          `Unregistered email polling for workflow ${workflowId}`,
        );
      }
    }
  }
}
