import { Injectable, Logger } from '@nestjs/common';

interface WebhookRegistration {
  workflowId: string;
  nodeId: string;
}

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);
  private webhooks = new Map<string, WebhookRegistration>();

  register(webhookPath: string, workflowId: string, nodeId: string): void {
    this.webhooks.set(webhookPath, { workflowId, nodeId });
    this.logger.log(
      `Registered webhook /${webhookPath} for workflow ${workflowId}`,
    );
  }

  unregister(webhookPath: string): void {
    this.webhooks.delete(webhookPath);
    this.logger.log(`Unregistered webhook /${webhookPath}`);
  }

  resolve(webhookPath: string): WebhookRegistration | undefined {
    return this.webhooks.get(webhookPath);
  }

  unregisterByWorkflow(workflowId: string): void {
    for (const [path, reg] of this.webhooks) {
      if (reg.workflowId === workflowId) {
        this.webhooks.delete(path);
      }
    }
  }
}
