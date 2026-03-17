import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import { WebhookHandler } from './handlers/webhook.handler';
import { CronHandler } from './handlers/cron.handler';
import { EmailHandler } from './handlers/email.handler';
import { EmailPollProcessor } from './processors/email-poll.processor';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'workflow' }),
    forwardRef(() => ExecutionModule),
  ],
  controllers: [TriggersController],
  providers: [
    TriggersService,
    WebhookHandler,
    CronHandler,
    EmailHandler,
    EmailPollProcessor,
  ],
  exports: [TriggersService],
})
export class TriggersModule {}
