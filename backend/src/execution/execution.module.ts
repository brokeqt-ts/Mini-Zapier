import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { ExecutionEngineService } from './execution-engine.service';
import { WorkflowProcessor } from './processors/workflow.processor';
import { ActionsModule } from '../actions/actions.module';
import { LoggingModule } from '../logging/logging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'workflow' }),
    ActionsModule,
    LoggingModule,
    NotificationsModule,
    PrismaModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionEngineService, WorkflowProcessor],
  exports: [ExecutionService],
})
export class ExecutionModule {}
