import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImapFlow } from 'imapflow';
import { ExecutionService } from '../../execution/execution.service';

interface EmailPollData {
  workflowId: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  subjectFilter?: string;
  fromFilter?: string;
}

@Processor('workflow')
export class EmailPollProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailPollProcessor.name);
  private processedUids = new Map<string, Set<number>>();

  constructor(private executionService: ExecutionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'email-poll') return;

    const data = job.data as EmailPollData;
    await this.pollEmails(data);
  }

  private async pollEmails(data: EmailPollData): Promise<void> {
    const client = new ImapFlow({
      host: data.imapHost,
      port: data.imapPort,
      secure: data.imapPort === 993,
      auth: {
        user: data.imapUser,
        pass: data.imapPass,
      },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const since = new Date();
        since.setHours(since.getHours() - 1);

        const messages = client.fetch(
          { since, seen: false },
          { envelope: true, source: true },
        );

        const workflowKey = data.workflowId;
        if (!this.processedUids.has(workflowKey)) {
          this.processedUids.set(workflowKey, new Set());
        }
        const processed = this.processedUids.get(workflowKey)!;

        for await (const msg of messages) {
          if (processed.has(msg.uid)) continue;

          const envelope = msg.envelope;
          if (!envelope) continue;

          const subject = envelope.subject || '';
          const from = envelope.from?.[0]?.address || '';

          if (data.subjectFilter && !subject.includes(data.subjectFilter)) {
            continue;
          }
          if (data.fromFilter && !from.includes(data.fromFilter)) {
            continue;
          }

          processed.add(msg.uid);

          const triggerData = {
            uid: msg.uid,
            subject,
            from,
            to: envelope.to?.map((a: { address?: string }) => a.address).join(', ') || '',
            date: envelope.date?.toISOString() || '',
            body: msg.source?.toString('utf-8')?.slice(0, 10000) || '',
          };

          this.logger.log(
            `New email matched for workflow ${data.workflowId}: "${subject}" from ${from}`,
          );

          await this.executionService.startExecution(
            data.workflowId,
            triggerData,
          );
        }

        // Keep only last 1000 UIDs to prevent memory leak
        if (processed.size > 1000) {
          const arr = Array.from(processed);
          this.processedUids.set(
            workflowKey,
            new Set(arr.slice(arr.length - 500)),
          );
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error(
        `Email poll failed for workflow ${data.workflowId}: ${error}`,
      );
    } finally {
      await client.logout().catch(() => {});
    }
  }
}
