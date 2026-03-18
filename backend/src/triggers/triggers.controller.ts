import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebhookHandler } from './handlers/webhook.handler';
import { ExecutionService } from '../execution/execution.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class TriggersController {
  constructor(
    private webhookHandler: WebhookHandler,
    private executionService: ExecutionService,
  ) {}

  @Post(':path')
  async handleWebhook(
    @Param('path') path: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    const registration = this.webhookHandler.resolve(path);
    if (!registration) {
      throw new NotFoundException('Webhook not found');
    }

    const triggerData = {
      body,
      headers,
      ...body, // keep top-level fields for backward compatibility
    };

    const execution = await this.executionService.startExecution(
      registration.workflowId,
      triggerData,
    );

    return { executionId: execution.id, status: 'triggered' };
  }
}
