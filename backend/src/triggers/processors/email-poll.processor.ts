import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImapFlow } from 'imapflow';
import * as dns from 'dns';
import { promisify } from 'util';
import { ExecutionService } from '../../execution/execution.service';
import { PrismaService } from '../../prisma/prisma.service';

const dnsLookup = promisify(dns.lookup);

interface EmailPollData {
  workflowId: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  subjectFilter?: string;
  fromFilter?: string;
  emailAccountId?: string;
}

@Processor('email-poll')
export class EmailPollProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailPollProcessor.name);
  /** workflowId → Set of "from|subject|date" fingerprints already triggered */
  private readonly triggered = new Map<string, Set<string>>();

  constructor(private executionService: ExecutionService, private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data = job.data as EmailPollData;
    await this.pollEmails(data);
  }

  private async pollEmails(data: EmailPollData): Promise<void> {
    // Load credentials from saved account if emailAccountId is set
    if (data.emailAccountId) {
      const account = await this.prisma.emailAccount.findUnique({
        where: { id: data.emailAccountId },
      });
      if (account?.imapHost) {
        data = {
          ...data,
          imapHost: account.imapHost,
          imapPort: account.imapPort ?? 993,
          imapUser: account.smtpUser,
          imapPass: account.smtpPass,
        };
      } else {
        this.logger.warn(
          `Email account ${data.emailAccountId} not found or has no IMAP host for workflow ${data.workflowId}`,
        );
        return;
      }
    }

    if (!data.imapHost || !data.imapUser || !data.imapPass) {
      this.logger.warn(
        `Workflow ${data.workflowId}: missing IMAP credentials (host=${data.imapHost}, user=${data.imapUser})`,
      );
      return;
    }

    this.logger.log(
      `Polling IMAP for workflow ${data.workflowId} (${data.imapUser}@${data.imapHost})`,
    );

    // Resolve hostname to IPv4 to avoid Windows c-ares DNS timeout bug
    let resolvedHost = data.imapHost;
    try {
      const result = await dnsLookup(data.imapHost, { family: 4 });
      resolvedHost = result.address;
    } catch {
      // fall back to raw hostname
    }

    const client = new ImapFlow({
      host: resolvedHost,
      port: data.imapPort,
      secure: data.imapPort === 993,
      auth: {
        user: data.imapUser,
        pass: data.imapPass,
      },
      tls: { servername: data.imapHost, rejectUnauthorized: false },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for unseen messages in the last 24h.
        // seen: false ensures we only trigger on unread emails.
        // ImapFlow marks emails as seen when fetching body, preventing re-trigger.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const searchResult = await client.search({ since, seen: false }, { uid: true });
        const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

        this.logger.log(
          `Workflow ${data.workflowId}: found ${uids.length} unread message(s) in last 24h`,
        );

        if (uids.length === 0) return;

        // Check workflow is still active before processing any messages
        const workflow = await this.prisma.workflow.findUnique({
          where: { id: data.workflowId },
          select: { status: true },
        });
        if (workflow?.status !== 'ACTIVE') {
          this.logger.log(
            `Workflow ${data.workflowId} is not ACTIVE (status=${workflow?.status}), skipping`,
          );
          return;
        }

        // Pass 1: fetch envelope only (does NOT mark as seen) — apply filters
        const matchingUids: number[] = [];
        const envelopes = new Map<number, { subject: string; from: string; to: string; date: string; fingerprint: string }>();

        for await (const msg of client.fetch(uids, { envelope: true }, { uid: true })) {
          const envelope = msg.envelope;
          if (!envelope) continue;

          const subject = envelope.subject || '';
          const from = envelope.from?.[0]?.address || '';

          if (data.subjectFilter && !subject.toLowerCase().includes(data.subjectFilter.toLowerCase())) {
            continue;
          }
          if (data.fromFilter && !from.toLowerCase().includes(data.fromFilter.toLowerCase())) {
            continue;
          }

          const rawDate = envelope.date?.toISOString() || '';
          const date = rawDate ? rawDate.replace('T', ' ').slice(0, 19) : '';
          const fingerprint = `${from}|${subject}|${date}`;

          if (!this.triggered.has(data.workflowId)) {
            this.triggered.set(data.workflowId, new Set());
          }
          if (this.triggered.get(data.workflowId)!.has(fingerprint)) {
            this.logger.log(
              `Workflow ${data.workflowId}: skipping duplicate email "${subject}" from ${from} at ${date}`,
            );
            continue;
          }

          envelopes.set(msg.uid, {
            subject,
            from,
            to: envelope.to?.map((a: { address?: string }) => a.address).join(', ') || '',
            date,
            fingerprint,
          });
          matchingUids.push(msg.uid);
        }

        if (matchingUids.length === 0) return;

        // Pass 2: fetch body only for matching messages (marks them as seen via BODY[])
        for await (const msg of client.fetch(matchingUids, { bodyParts: ['1'] }, { uid: true })) {
          const meta = envelopes.get(msg.uid);
          if (!meta) continue;

          const bodyBuf = msg.bodyParts?.get('1');
          const body = bodyBuf ? bodyBuf.toString('utf-8').slice(0, 10000) : '';

          const { fingerprint, ...metaWithoutFingerprint } = meta;
          const triggerData = { uid: msg.uid, ...metaWithoutFingerprint, body };

          this.logger.log(
            `Workflow ${data.workflowId}: triggering on email "${meta.subject}" from ${meta.from}`,
          );

          await this.executionService.startExecution(data.workflowId, triggerData);

          // Register fingerprint only after successful execution start
          this.triggered.get(data.workflowId)!.add(fingerprint);
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error(
        `Email poll failed for workflow ${data.workflowId} (${data.imapUser}@${data.imapHost}): ${error}`,
      );
    } finally {
      await client.logout().catch(() => {});
    }
  }
}
